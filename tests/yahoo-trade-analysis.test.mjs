import assert from "node:assert/strict";
import worker from "../worker.js";
import { keeperCost, normalizeYahooDraft, saveYahooAuctionLedger } from "../yahoo-auction-draft.js";
import { analyzeYahooOffers, tradeLeagueRules } from "../yahoo-trade-analysis.js";

const leagueKey = "470.l.868349";
const player = (id, name, position, sourceTeamKey, destinationTeamKey) => ({
  key: "470.p." + id, name, position, sourceTeamKey, destinationTeamKey
});
const mine = leagueKey + ".t.1";
const rival = leagueKey + ".t.2";
const giving = [player(11, "Veteran QB", "QB", mine, rival)];
const receiving = [player(12, "Young QB", "QB", rival, mine), player(13, "Young Receiver", "WR", rival, mine)];
const costs = { 11: "40", 12: "5", 13: "9" };
const rows = Array.from({ length: 216 }, (_, i) => {
  const id = i + 11;
  const teamKey = i === 0 ? mine : i < 3 ? rival : leagueKey + ".t." + ((i % 12) + 1);
  return { draft_result: { pick: String(i + 1), round: String(Math.floor(i / 12) + 1),
    team_key: teamKey, player_key: "470.p." + id, cost: costs[id] || "1", is_keeper: i < 3 ? "1" : "0" } };
});
const metadata = { league_key: leagueKey, season: "2026", draft_status: "postdraft", num_teams: "12", end_week: "17" };
const collection = rows => Object.assign({ count: rows.length }, rows);
const rawDraft = { fantasy_content: { league: [[metadata], { draft_results: collection(rows) }] } };
const settings = { season: 2026, draftStatus: "postdraft" };
const getRows = collection => Object.values(collection).flatMap(item => item?.draft_result ? [item.draft_result] : []);
class MemoryKv {
  constructor(entries = {}) { this.records = new Map(Object.entries(entries).map(([key, val]) => [key, JSON.stringify(val)])); }
  async get(key, options) {
    const value = this.records.get(key);
    return value == null ? null : options?.type === "json" ? JSON.parse(value) : value;
  }
  async put(key, value) { this.records.set(key, value); }
  async delete(key) { this.records.delete(key); }
}
const profile = {
  id: "aeok-auction", name: "AEOK Auction League", sport: "nfl", platform: "yahoo", yahooLeagueKey: leagueKey,
  tradeAnalysis: { teamStrategies: {
    [mine]: { season: 2026, intent: "rebuilding", playoffOdds: 0.05, asOf: "2026-11-18", source: "Manager" },
    [rival]: { season: 2026, intent: "contending", asOf: "2026-11-18", source: "Manager" }
  } }
};
const rules = tradeLeagueRules(profile, leagueKey);
const draft = normalizeYahooDraft(rawDraft, leagueKey, getRows, settings);
assert.equal(draft.complete, true);
const ledger = new MemoryKv();
draft.ledgerId = await saveYahooAuctionLedger(ledger, draft);
assert.equal(await saveYahooAuctionLedger(ledger, draft), draft.ledgerId);
assert.equal(ledger.records.size, 1);
const changed = { ...draft, results: draft.results.map(row => row.playerId === "11" ? { ...row, cost: 45 } : row) };
assert.notEqual(await saveYahooAuctionLedger(ledger, changed), draft.ledgerId);
assert.equal((await ledger.get(draft.ledgerId, { type: "json" })).rows[0].cost, 40);
assert.deepEqual([giving[0], ...receiving].map(p => keeperCost(p, draft, rules).nextCost), [41, 6, 10]);
assert.equal(keeperCost(player(999, "Undrafted QB", "QB"), draft, rules).nextCost, 6);
assert.equal(keeperCost(player(999, "Undrafted WR", "WR"), draft, rules).nextCost, 2);
assert.equal(keeperCost(player(999, "Missing position", ""), draft, rules).status, "position-unavailable");
assert.equal(keeperCost({ ...giving[0], key: "469.p.11" }, draft, rules).status, "season-mismatch");
assert.equal(keeperCost(player(999, "Unknown", "QB"), { ...draft, complete: false }, rules).status, "unverified-draft");
const missingPrice = { ...draft, results: draft.results.map(row => ({ ...row, cost: null })) };
assert.equal(keeperCost(giving[0], missingPrice, rules).status, "draft-price-unavailable");
assert.equal(normalizeYahooDraft(rawDraft, leagueKey, getRows, { ...settings, draftStatus: "predraft" }).complete, false);
const draftWithDuplicate = { fantasy_content: { league: [[metadata], { draft_results: collection([rows[0], rows[0]]) }] } };
assert.equal(normalizeYahooDraft(draftWithDuplicate, leagueKey, getRows, settings).complete, false);

const live = { leagueKey, team: { key: mine }, offers: [{ giving, receiving, complete: true, partnerTeamKey: rival }] };
const values = (x, y, z) => ({ "470.p.11": x, "470.p.12": y, "470.p.13": z });
const valuation = (source, numbers) => ({ source, asOf: "2026-11-18", values: numbers });
const valuations = {
  market: { ...valuation("Example market", values(100, 72, 45)), format: "dynasty-superflex", replacementValue: 20 },
  projectedAuction: valuation("Independent auction model", values(58, 35, 23)),
  projectedRestOfSeason: valuation("Independent ROS model", values(135, 90, 51))
};
const toRosterRow = player => ({ player_key: player.key, pos: player.position, roster_slot: "BN" });
const roster = (players, full = false) => ({ players: [...players.map(toRosterRow),
  ...Array.from({ length: full ? 18 - players.length : 0 }, (_, i) => toRosterRow(player(500 + i, "Bench", "RB"))) ] });
const rosters = { [mine]: roster(giving, true), [rival]: roster(receiving) };
const input = { profile, live, draft, settings, rosters, valuations };
let analysis = analyzeYahooOffers(input);
let [offer] = analysis.offers;
assert.equal(analysis.leagueContext.prioritizedHorizon, "next-season-keeper-surplus");
assert.equal(offer.keeper.salaryFreedIfAllKept, 25);
assert.equal(offer.keeper.budgetFreedAfterOpenSlotReserve, 26);
assert.equal(offer.keeper.projectedSurplusDelta, 25);
assert.equal(offer.production.restOfSeason.acquiredPlayerPointsDelta, 6);
assert.equal(offer.rosterImpact.mine.requiredRosterCuts, 1);
assert.equal(offer.market.dynastyProxy, true);
assert.equal(offer.market.partnerMarketPosition, null);
assert.ok(offer.market.myMarketDelta < 0, "two players with a larger raw sum can still lose on market package value");
assert.equal(offer.missing.length, 0);
const staleRosters = { [mine]: roster([]), [rival]: roster(receiving) };
assert.equal(analyzeYahooOffers({ ...input, rosters: staleRosters }).offers[0].keeper, null);

const redraft = analyzeYahooOffers({ ...input, profile: { id: "redraft", leagueType: "redraft" } });
assert.deepEqual(redraft.leagueContext.horizons, ["rest-of-season", "playoffs"]);
assert.equal(redraft.offers[0].keeper, null);
assert.equal(redraft.offers[0].market.dynastyProxy, true);
const dynasty = analyzeYahooOffers({ ...input, profile: { id: "dynasty", leagueType: "dynasty" } });
assert.ok(dynasty.leagueContext.horizons.includes("multi-year"));
assert.equal(dynasty.offers[0].market.dynastyProxy, false);
assert.ok(dynasty.offers[0].market.partnerMarketPosition);
assert.equal(analyzeYahooOffers({ ...input, draft: null }).offers[0].keeper, null);

const token = "a".repeat(64);
const tokenHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))]
  .map(byte => byte.toString(16).padStart(2, "0")).join("");
const origin = "https://draft.test";
const kv = new MemoryKv({
  "league:aeok-auction": profile,
  "yahooAuth:default": { access_token: "private-yahoo-token", expires_at: Date.now() + 3600000, owner_id: "owner" },
  "user:owner": { id: "owner", admin: true },
  "user:rival": { id: "rival", admin: true },
  ["mcp:access:" + tokenHash]: { subject: "owner", clientId: "https://chatgpt.com/oauth/client.json",
    resource: origin + "/mcp", scope: "trades:read trade-context:read", expiresAt: Date.now() + 3600000 }
});
const env = { AUTH_TOKEN: "test-only-secret", MOCKS: kv, MCP_PUBLIC_ORIGIN: origin };
const wrap = (field, data) => ({ fantasy_content: { league: [[metadata], { [field]: data }] } });
const teamRows = [
  { team: [{ team_key: mine, name: "My team", is_owned_by_current_login: 1 }, { team_standings: { rank: 11 } }] },
  { team: [{ team_key: rival, name: "Other team" }, { team_standings: { rank: 3 } }] }
];
const tradingPlayers = [...giving, ...receiving].map(p => ({
  player: [[{ player_key: p.key, name: { full: p.name }, display_position: p.position }],
    { transaction_data: { source_team_key: p.sourceTeamKey, destination_team_key: p.destinationTeamKey } }]
}));
const pending = { transaction: [{ type: "pending_trade", transaction_key: leagueKey + ".pt.1", status: "proposed",
  trader_team_key: rival, tradee_team_key: mine }, { players: collection(tradingPlayers) }] };
const requests = [];
const originalFetch = globalThis.fetch;
let incomplete = false;
globalThis.fetch = async (input, init) => {
  assert.equal(init.method ?? "GET", "GET", "Yahoo fantasy endpoints are read-only");
  assert.equal(init.headers.Authorization, "Bearer private-yahoo-token");
  const path = new URL(input).pathname.replace(/^\/fantasy\/v2\//, "");
  requests.push(path);
  if (path.endsWith("/teams")) return Response.json(wrap("teams", collection(teamRows)));
  if (path.endsWith("/standings")) return Response.json(wrap("standings", [{ teams: collection(teamRows) }]));
  if (path.endsWith("/settings")) return Response.json(wrap("settings", [
    { draft_type: "auction", scoring_type: "head", num_playoff_teams: "6", playoff_start_week: "15",
      stat_modifiers: { stats: [{ stat: { stat_id: 11, value: "1" } }] } }
  ]));
  if (path.endsWith("/draftresults")) return Response.json(incomplete ? wrap("draft_results", collection(rows.slice(0, 3))) : rawDraft);
  if (path.includes("/transactions;")) return Response.json(wrap("transactions", collection([pending])));
  if (path.startsWith("players;player_keys")) return Response.json({ fantasy_content: { players: collection(tradingPlayers) } });
  if (path.endsWith("/roster")) {
    const rows = (path.includes(mine) ? giving : receiving).map(p => ({ player: [
      [{ player_key: p.key, display_position: p.position }], { selected_position: [{ position: "BN" }] }
    ] }));
    return Response.json({ fantasy_content: { team: [{}, { roster: { players: collection(rows) } }] } });
  }
  throw new Error("Unexpected Yahoo path " + path);
};
try {
  const get = path => worker.fetch(new Request(origin + path, { headers: { "x-auth-token": "test-only-secret" } }), env, {});
  const rpc = (name, args) => worker.fetch(new Request(origin + "/mcp", { method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })
  }), env, {});
  const draftResponse = await get("/api/yahoo/auction-draft-results?league=aeok-auction&season=2026");
  assert.equal(draftResponse.status, 200, await draftResponse.clone().text());
  assert.equal(draftResponse.headers.get("cache-control"), "no-store");
  const official = await draftResponse.json();
  assert.equal(official.complete, true);
  assert.equal(official.results[0].name, "Veteran QB");
  assert.equal(official.results[0].nextKeeperCost, 41);
  assert.equal(official.keeperSeason, 2027);
  assert.match(official.ledgerId, /^yahooAuctionLedger:470\.l\.868349:2026:/);
  const analysisResponse = await rpc("get_yahoo_trade_analysis", { league: "aeok-auction", valuations,
    counteroffers: [{ partnerTeamKey: rival, giving: [giving[0].key], receiving: [receiving[0].key] },
      { partnerTeamKey: rival, giving: [giving[0].key], receiving: ["470.p.999"] }] });
  const body = (await analysisResponse.json()).result;
  assert.equal(body.isError, undefined, JSON.stringify(body));
  assert.equal(body.structuredContent.offers[0].keeper.salaryFreedIfAllKept, 25);
  assert.equal(body.structuredContent.offers[0].rosterImpact.partner.record.rank, 3);
  assert.equal(body.structuredContent.counteroffers[0].status, "hypothetical");
  assert.match(body.structuredContent.counteroffers[1].error, /current Yahoo roster/);
  assert.equal(body.structuredContent.leagueContext.settings.playoffTeams, 6);
  assert.equal(body.structuredContent.leagueContext.settings.playoffStartWeek, 15);
  assert.ok(!JSON.stringify(body).includes("private-yahoo-token"));
  assert.equal((await get("/api/yahoo/auction-draft-results?league=aeok-auction&season=2025")).status, 502);
  incomplete = true;
  const partial = await (await get("/api/yahoo/trade-analysis?league=aeok-auction")).json();
  assert.equal(partial.offers[0].keeper, null);
  assert.ok(partial.offers[0].missing.includes("verified keeper costs"));
  const accessKey = "mcp:access:" + tokenHash;
  const access = await kv.get(accessKey, { type: "json" });
  await kv.put(accessKey, JSON.stringify({ ...access, subject: "rival" }));
  const priorReads = requests.length;
  const denied = (await (await rpc("get_pending_trades", { league: "aeok-auction" })).json()).result;
  assert.equal(denied.isError, true);
  assert.equal(requests.length, priorReads, "a different admin cannot read the owner's connected Yahoo grant");
} finally {
  globalThis.fetch = originalFetch;
}
console.log("Yahoo auction drafts, keeper costs, trade analysis and owner authorization tests passed.");

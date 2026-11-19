const SOURCE = "Yahoo official draft results";
const LEAGUE_KEY = /^\d+\.l\.\d+$/;

function nodesNamed(value, name, found = []) {
  if (Array.isArray(value)) {
    for (const child of value) nodesNamed(child, name, found);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === name) found.push(child);
      nodesNamed(child, name, found);
    }
  }
  return found;
}

function integer(value) {
  if (typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function normalizeYahooDraft(raw, key, collect, { season, draftStatus } = {}) {
  const node = raw?.fantasy_content?.league;
  const meta = Array.isArray(node) ? Object.assign({}, ...[].concat(node[0] || {})) : node;
  const collections = nodesNamed(node, "draft_results");
  if (collections.length !== 1 || !collections[0] || typeof collections[0] !== "object") {
    throw new Error("Yahoo did not return a recognizable draft results collection.");
  }
  const collection = collections[0];
  const rawRows = collect(collection, "draft_result");
  const gameKey = key.split(".")[0];
  const teamPattern = new RegExp("^" + gameKey + "\\.l\\." + key.split(".")[2] + "\\.t\\.\\d+$");
  const playerPattern = new RegExp("^" + gameKey + "\\.p\\.(\\d+)$");
  const rows = rawRows.map(row => ({
    pick: integer(row.pick),
    round: integer(row.round),
    teamKey: String(row.team_key || ""),
    playerKey: String(row.player_key || ""),
    playerId: playerPattern.exec(row.player_key || "")?.[1] || null,
    cost: integer(row.cost),
    keeper: String(row.is_keeper ?? "") === "1" || row.is_keeper === true
  }));
  const validRows = rows.filter(row => row.playerId && teamPattern.test(row.teamKey));
  const count = Array.isArray(collection) ? collection.length : integer(collection.count);
  const seasonYear = integer(season ?? meta?.season);
  const draftComplete = (draftStatus ?? meta?.draft_status) === "postdraft";
  const complete = LEAGUE_KEY.test(key) && meta?.league_key === key && seasonYear !== null &&
    (meta.season == null || integer(meta.season) === seasonYear) &&
    (meta.draft_status == null || meta.draft_status === "postdraft") &&
    draftComplete && count > 0 && count === rows.length && validRows.length === rows.length &&
    new Set(rows.map(row => row.playerId)).size === rows.length;
  return {
    key, season: seasonYear, source: SOURCE, fetchedAt: new Date().toISOString(), complete,
    results: validRows.sort((a, b) => (a.pick ?? 0) - (b.pick ?? 0))
  };
}

// Content-address snapshots so a retry or a concurrent read cannot replace a
// season's old price data. A different official provider response is a new snapshot.
export async function saveYahooAuctionLedger(kv, draft) {
  const rows = draft.results.map(({ playerId, teamKey, cost, keeper }) => ({ playerId, teamKey, cost, keeper }))
    .sort((a, b) => Number(a.playerId) - Number(b.playerId));
  const bytes = new TextEncoder().encode(JSON.stringify(rows));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
  const id = `yahooAuctionLedger:${draft.key}:${draft.season}:${hash}`;
  if (!(await kv.get(id))) {
    await kv.put(id, JSON.stringify({ key: draft.key, season: draft.season, source: SOURCE, rows }));
  }
  return id;
}

export function keeperCost(player, draft, rules) {
  const playerId = /^\d+\.p\.(\d+)$/.exec(player.key || "")?.[1];
  const base = { draftSeason: draft?.season ?? null, keeperSeason: draft?.season ? draft.season + 1 : null,
    source: draft?.source ?? null, fetchedAt: draft?.fetchedAt ?? null, ledgerId: draft?.ledgerId ?? null };
  if (!playerId || !draft?.complete || !draft.ledgerId) return { ...base, status: "unverified-draft" };
  if (!player.key.startsWith(draft.key.split(".")[0] + ".p.")) return { ...base, status: "season-mismatch" };
  const pick = draft.results.find(row => row.playerId === playerId);
  if (pick) {
    if (pick.cost === null) return { ...base, status: "draft-price-unavailable" };
    return { ...base, status: "drafted", baseCost: pick.cost, nextCost: pick.cost + rules.annualIncrease, keeperAtDraft: pick.keeper };
  }
  const position = String(player.position || "").split(/[ ,/]+/)[0].toUpperCase();
  if (!position) return { ...base, status: "position-unavailable" };
  return { ...base, status: "undrafted", baseCost: null,
    nextCost: position === "QB" ? rules.undraftedQb : rules.undraftedOther };
}

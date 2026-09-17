var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,x-auth-token"
};
var J = /* @__PURE__ */ __name((obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } }), "J");
function authed(request, env) {
  if (!env.AUTH_TOKEN) return true;
  return request.headers.get("x-auth-token") === env.AUTH_TOKEN;
}
__name(authed, "authed");
function leagueId(url) {
  const l = url.searchParams.get("league");
  return l && /^[a-z0-9-]{1,40}$/.test(l) ? l : "aeo-keepers";
}
__name(leagueId, "leagueId");
var setupKey = /* @__PURE__ */ __name((lg) => lg === "aeo-keepers" ? "setup:main" : `setup:${lg}`, "setupKey");
var historyKey = /* @__PURE__ */ __name((lg) => `history:${lg}`, "historyKey");
var mocksIndexKey = /* @__PURE__ */ __name((lg) => lg === "aeo-keepers" ? "index" : `index:${lg}`, "mocksIndexKey");
var mockRecordKey = /* @__PURE__ */ __name((lg, id) => lg === "aeo-keepers" ? `mock:${id}` : `mock:${lg}:${id}`, "mockRecordKey");
var leagueProfileKey = /* @__PURE__ */ __name((id) => `league:${id}`, "leagueProfileKey");
var leagueHistoryKey = /* @__PURE__ */ __name((id) => `leagueHistory:${id}`, "leagueHistoryKey");
var commishKey = /* @__PURE__ */ __name((lg) => `commish:${lg}`, "commishKey");
var commishHistoryKey = /* @__PURE__ */ __name((lg) => `commishHistory:${lg}`, "commishHistoryKey");
var inSeasonStateKey = /* @__PURE__ */ __name((lg) => `inseason:${lg}`, "inSeasonStateKey");
var inSeasonReportsKey = /* @__PURE__ */ __name((lg) => `inseasonReports:${lg}`, "inSeasonReportsKey");
var inSeasonReportKey = /* @__PURE__ */ __name((lg, id) => `inseasonReport:${lg}:${id}`, "inSeasonReportKey");
var leagueSourceConfigKey = /* @__PURE__ */ __name((lg) => `leagueSource:${lg}`, "leagueSourceConfigKey");
var leagueSnapshotKey = /* @__PURE__ */ __name((lg) => `leagueSnapshot:${lg}`, "leagueSnapshotKey");
var FAAB_CALIBRATION_VERSION = "off-with-their-heads-2025-plus-2026-09-16";
function slugify(s) {
  return String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "").slice(0, 40) || "league";
}
__name(slugify, "slugify");
var ACCOUNTS_ON = /* @__PURE__ */ __name((env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), "ACCOUNTS_ON");
var SESSION_COOKIE = "aeo_session";
var OAUTH_STATE_COOKIE = "aeo_oauth_state";
var SESSION_DAYS = 30;
var userKey = /* @__PURE__ */ __name((uid) => `user:${uid}`, "userKey");
var USERS_INDEX = "users:index";
var googleRedirectUri = /* @__PURE__ */ __name((url) => `${url.origin}/auth/google/callback`, "googleRedirectUri");
var sessionSecret = /* @__PURE__ */ __name((env) => env.SESSION_SECRET || env.GOOGLE_CLIENT_SECRET || "", "sessionSecret");
function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(b64urlEncode, "b64urlEncode");
function b64urlDecode(str) {
  const pad = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(pad + "=".repeat((4 - pad.length % 4) % 4));
}
__name(b64urlDecode, "b64urlDecode");
async function hmacHex(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacHex, "hmacHex");
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
__name(safeEqual, "safeEqual");
async function signSession(env, uid) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const body = `${b64urlEncode(uid)}.${exp}`;
  return `${body}.${await hmacHex(sessionSecret(env), body)}`;
}
__name(signSession, "signSession");
async function verifySession(env, value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 3) return null;
  const [uidPart, expPart, sig] = parts;
  const expected = await hmacHex(sessionSecret(env), `${uidPart}.${expPart}`);
  if (!safeEqual(sig, expected)) return null;
  if (Date.now() > Number(expPart)) return null;
  try {
    return b64urlDecode(uidPart);
  } catch {
    return null;
  }
}
__name(verifySession, "verifySession");
function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
__name(readCookie, "readCookie");
function setCookie(name, value, maxAgeSeconds) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}
__name(setCookie, "setCookie");
async function currentUser(request, env, kv) {
  if (!ACCOUNTS_ON(env)) return { id: "owner", name: "Owner", admin: true, accountsOff: true };
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return null;
  const uid = await verifySession(env, raw);
  if (!uid) return null;
  return await kv.get(userKey(uid), { type: "json" }) || null;
}
__name(currentUser, "currentUser");
async function upsertUser(kv, profile) {
  const existing = await kv.get(userKey(profile.id), { type: "json" });
  if (existing) {
    const updated = { ...existing, email: profile.email, name: profile.name, picture: profile.picture };
    await kv.put(userKey(profile.id), JSON.stringify(updated));
    return updated;
  }
  const idx = await kv.get(USERS_INDEX, { type: "json" }) || [];
  const rec = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    admin: idx.length === 0,
    createdAt: Date.now()
  };
  await kv.put(userKey(rec.id), JSON.stringify(rec));
  idx.push({ id: rec.id, email: rec.email, name: rec.name, admin: rec.admin, createdAt: rec.createdAt });
  await kv.put(USERS_INDEX, JSON.stringify(idx));
  return rec;
}
__name(upsertUser, "upsertUser");
var scoped = /* @__PURE__ */ __name((base, me) => me && me.admin ? base : `${base}:u:${me.id}`, "scoped");
var YAHOO_AUTH_KEY = "yahooAuth:default";
var yahooRedirectUri = /* @__PURE__ */ __name((url) => `${url.origin}/auth/yahoo/callback`, "yahooRedirectUri");
async function yahooTokenRequest(env, params) {
  const basic = btoa(`${env.YAHOO_CLIENT_ID}:${env.YAHOO_CLIENT_SECRET}`);
  const r = await fetch("https://api.login.yahoo.com/oauth2/get_token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString()
  });
  if (!r.ok) throw new Error("Yahoo token endpoint returned " + r.status + ": " + (await r.text()).slice(0, 300));
  return r.json();
}
__name(yahooTokenRequest, "yahooTokenRequest");
async function getYahooAccessToken(env, kv, url) {
  const auth = await kv.get(YAHOO_AUTH_KEY, { type: "json" });
  if (!auth) return null;
  if (Date.now() < auth.expires_at - 6e4) return auth.access_token;
  const tok = await yahooTokenRequest(env, {
    grant_type: "refresh_token",
    redirect_uri: yahooRedirectUri(url),
    refresh_token: auth.refresh_token
  });
  const updated = {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || auth.refresh_token,
    expires_at: Date.now() + tok.expires_in * 1e3,
    connected_at: auth.connected_at || null
    // survives refreshes; see the callback
  };
  await kv.put(YAHOO_AUTH_KEY, JSON.stringify(updated));
  return updated.access_token;
}
__name(getYahooAccessToken, "getYahooAccessToken");
function csvMatrix(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const src = String(text || "").replace(/\r\n?/g, "\n");
  for (let i = 0; i <= src.length; i++) {
    const ch = i < src.length ? src[i] : "\n";
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  return rows;
}
__name(csvMatrix, "csvMatrix");
function parseCsvObjects(text) {
  const rows = csvMatrix(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => String(h).toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] == null ? "" : r[i]]))).filter((r) => r.name || r.player);
}
__name(parseCsvObjects, "parseCsvObjects");
var n = /* @__PURE__ */ __name((v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback, "n");
var clamp = /* @__PURE__ */ __name((v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v)), "clamp");
function ratio(v, fallback = 0) {
  const x = n(v, fallback);
  return clamp(x > 1 ? x / 100 : x);
}
__name(ratio, "ratio");
function playerPoolMap(profile) {
  const map = new Map();
  parseCsvObjects(profile && profile.playersCsv || "").forEach((p) => {
    const name = String(p.name || p.player || "").trim();
    if (!name) return;
    map.set(name.toLowerCase(), {
      name,
      pos: String(p.pos || p.position || "").toUpperCase(),
      team: String(p.team || "").toUpperCase(),
      rosRank: n(p.ros_rank || p.ecr || p.adp, 999),
      seasonProjection: n(p.proj || p.projection, 0),
      weekProjection: n(p.week_proj || p.week_projection, 0)
    });
  });
  return map;
}
__name(playerPoolMap, "playerPoolMap");
function normalizeFaabPlayer(raw, pool, currentWeek) {
  const named = String(raw.name || raw.player || "").trim();
  const base = pool.get(named.toLowerCase()) || {};
  const pos = String(raw.pos || raw.position || base.pos || "").toUpperCase();
  const rank = n(raw.ros_rank || raw.rank || raw.ecr, base.rosRank || 999);
  const seasonProjection = n(raw.season_projection || raw.proj, base.seasonProjection || 0);
  const weekProjection = n(raw.week_proj || raw.week_projection, base.weekProjection || (seasonProjection ? seasonProjection / 17 : 0));
  const status = String(raw.status || "").toUpperCase();
  const byeWeek = n(raw.bye_week || raw.bye, 0);
  const unavailable = status === "O" || status === "IR" || status === "SUSP" || status === "NA" || byeWeek === currentWeek;
  const injuryRisk = raw.injury === "" || raw.injury == null ? status === "Q" || status === "D" ? 0.45 : unavailable ? 1 : 0.08 : ratio(raw.injury);
  let derivedEndgame = rank <= 5 ? 0.95 : rank <= 12 ? 0.75 : rank <= 30 ? 0.5 : rank <= 60 ? 0.25 : 0.08;
  if (pos === "QB" || pos === "TE") derivedEndgame *= 0.75;
  return {
    name: named || base.name || "Unknown",
    pos,
    team: String(raw.team || base.team || "").toUpperCase(),
    rosRank: rank,
    weekProjection,
    endgame: raw.endgame === "" || raw.endgame == null ? derivedEndgame : ratio(raw.endgame),
    role: raw.role === "" || raw.role == null ? 0.75 : ratio(raw.role),
    schedule: clamp(n(raw.schedule || raw.schedule_grade, 3), 1, 5),
    injuryRisk,
    teammateOpportunity: raw.teammate === "" || raw.teammate == null ? ratio(raw.teammate_opportunity, 0) : ratio(raw.teammate),
    byeWeek,
    status,
    unavailable,
    notes: String(raw.notes || "").trim()
  };
}
__name(normalizeFaabPlayer, "normalizeFaabPlayer");
function starterLineup(roster, profile) {
  const used = new Set(), starters = [];
  const pick = /* @__PURE__ */ __name((eligible) => {
    const p = roster.filter((x) => !used.has(x) && eligible.includes(x.pos)).sort((a, b) => b.adjustedWeek - a.adjustedWeek)[0];
    if (p) {
      used.add(p);
      starters.push(p);
    }
  }, "pick");
  const slots = profile && profile.starters || { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2 };
  ["QB", "RB", "WR", "TE", "K", "DST"].forEach((pos) => {
    for (let i = 0; i < n(slots[pos], 0); i++) pick([pos]);
  });
  const flexEligible = profile && profile.flexEligible || ["RB", "WR", "TE"];
  for (let i = 0; i < n(slots.FLEX || slots.flex, 0); i++) pick(flexEligible);
  for (let i = 0; i < n(slots.SUPERFLEX || slots.superflex, 0); i++) pick(["QB", "RB", "WR", "TE"]);
  return { starters, total: starters.reduce((sum, p) => sum + p.adjustedWeek, 0) };
}
__name(starterLineup, "starterLineup");
function marketShareFor(player, tier, teamsAlive) {
  const is12 = teamsAlive <= 13;
  const table18 = {
    elite: { QB: 0.055, RB: 0.351, WR: 0.351, TE: 0.065 },
    core: { QB: 0.03, RB: 0.201, WR: 0.201, TE: 0.03 },
    starter: { QB: 0.02, RB: 0.076, WR: 0.057, TE: 0.021 },
    depth: { QB: 0.005, RB: 0.012, WR: 0.01, TE: 0.005 }
  };
  const table12 = {
    elite: { QB: 0.04, RB: 0.2, WR: 0.18, TE: 0.057 },
    core: { QB: 0.025, RB: 0.1, WR: 0.075, TE: 0.025 },
    starter: { QB: 0.012, RB: 0.047, WR: 0.051, TE: 0.013 },
    depth: { QB: 0.003, RB: 0.007, WR: 0.005, TE: 0.003 }
  };
  const lo = table12[tier][player.pos] || table12[tier].WR;
  const hi = table18[tier][player.pos] || table18[tier].WR;
  const t = clamp((teamsAlive - 12) / 6);
  return is12 ? lo : lo + (hi - lo) * t;
}
__name(marketShareFor, "marketShareFor");
function tierFor(player, upgrade) {
  if ((player.pos === "RB" || player.pos === "WR") && (player.endgame >= 0.85 || player.rosRank <= 5)) return "elite";
  if ((player.pos === "RB" || player.pos === "WR") && (player.endgame >= 0.65 || player.rosRank <= 12)) return "core";
  if (player.rosRank <= 40 || upgrade >= 0.75) return "starter";
  return "depth";
}
__name(tierFor, "tierFor");
function maxShareFor(player, tier, teamsAlive) {
  const t = clamp((teamsAlive - 12) / 6);
  const lo = { elite: 0.24, core: 0.14, starter: player.pos === "RB" ? 0.07 : player.pos === "WR" ? 0.06 : 0.025, depth: 0.015 }[tier];
  const hi = { elite: 0.36, core: 0.22, starter: player.pos === "RB" ? 0.1 : player.pos === "WR" ? 0.08 : player.pos === "TE" ? 0.04 : 0.05, depth: 0.02 }[tier];
  return lo + (hi - lo) * t;
}
__name(maxShareFor, "maxShareFor");
function analyzeFaab(input, profile = {}) {
  const currentWeek = Math.max(1, n(input.week, 1));
  const startingBudget = Math.max(1, n(input.startingBudget || input.starting_budget, 1e3));
  const remainingBudget = clamp(n(input.remainingBudget || input.remaining_budget, startingBudget), 0, startingBudget);
  const teamsAlive = Math.max(2, n(input.teamsAlive || input.teams_alive, profile.teams || 18));
  const initialTeams = Math.max(teamsAlive, n(input.initialTeams || input.initial_teams, profile.teams || teamsAlive));
  const aggression = clamp(n(input.aggression, 0.8), 0.4, 1.1);
  const pool = playerPoolMap(profile);
  const rosterRaw = Array.isArray(input.roster) ? input.roster : parseCsvObjects(input.rosterCsv || input.roster_csv || "");
  const availableRaw = Array.isArray(input.available) ? input.available : parseCsvObjects(input.availableCsv || input.available_csv || "");
  const roster = rosterRaw.map((p) => normalizeFaabPlayer(p, pool, currentWeek)).map((p) => ({ ...p, adjustedWeek: p.unavailable ? 0 : p.weekProjection * (1 - p.injuryRisk * 0.28) }));
  const baseLineup = starterLineup(roster, profile);
  const recommendations = availableRaw.map((raw) => {
    const p = normalizeFaabPlayer(raw, pool, currentWeek);
    const adjustedWeek = p.unavailable ? 0 : p.weekProjection * (1 - p.injuryRisk * 0.32);
    const withPlayer = starterLineup([...roster, { ...p, adjustedWeek }], profile);
    const upgrade = Math.max(0, withPlayer.total - baseLineup.total);
    const displaced = baseLineup.starters.find((x) => !withPlayer.starters.some((y) => y.name === x.name));
    const need = clamp(upgrade / 6 + (displaced ? 0.12 : 0));
    const immediate = clamp(adjustedWeek / 18);
    const tier = tierFor(p, upgrade);
    const scarcity = clamp((teamsAlive - 10) / 10) * ({ RB: 1, WR: 0.88, TE: 0.55, QB: 0.35 }[p.pos] || 0.5);
    const phaseFactor = 0.78 + 0.22 * teamsAlive / initialTeams;
    const marketShare = marketShareFor(p, tier, teamsAlive) * phaseFactor * (0.82 + 0.18 * p.role) * (1 + (p.schedule - 3) * 0.025) * (1 - p.injuryRisk * 0.2);
    const projectedWinningBid = Math.max(0, Math.round(startingBudget * marketShare));
    const utilityMultiplier = 0.7 + 0.45 * need + 0.2 * p.endgame + 0.1 * immediate + 0.06 * scarcity + 0.05 * p.teammateOpportunity;
    const rawFair = Math.min(maxShareFor(p, tier, teamsAlive), marketShare * utilityMultiplier) * remainingBudget * aggression;
    const fairBid = Math.max(0, Math.round(rawFair));
    const chaseThreshold = tier === "elite" ? 1.15 : tier === "core" ? 1.2 : 1.6;
    const marketReachable = projectedWinningBid + 1 <= fairBid * chaseThreshold;
    const recommendedBid = Math.min(remainingBudget, Math.max(0, Math.round(marketReachable ? Math.max(fairBid, projectedWinningBid + 1) : fairBid)));
    const stretchBid = Math.min(remainingBudget, Math.max(recommendedBid, Math.round(marketReachable ? Math.max(fairBid * 1.2, projectedWinningBid + (tier === "starter" ? 3 : 1)) : fairBid * 1.15)));
    const reasons = [];
    if (p.endgame >= 0.8) reasons.push("endgame-caliber profile");
    else if (p.endgame >= 0.55) reasons.push("possible long-term starter");
    if (upgrade >= 2) reasons.push(`adds ${upgrade.toFixed(1)} projected lineup points this week`);
    else if (upgrade > 0) reasons.push(`small ${upgrade.toFixed(1)}-point immediate upgrade`);
    else reasons.push("does not currently improve the optimal starting lineup");
    if (p.byeWeek === currentWeek) reasons.push("on bye this week");
    if (p.injuryRisk >= 0.45) reasons.push("material injury/availability risk");
    if (p.schedule >= 4) reasons.push("favorable upcoming schedule input");
    if (p.teammateOpportunity >= 0.4) reasons.push("teammate news raises opportunity");
    if (!marketReachable) reasons.push("projected market exceeds this roster's disciplined price");
    return {
      ...p,
      tier,
      replacement: displaced ? displaced.name : null,
      replacementProjection: displaced ? Number(displaced.adjustedWeek.toFixed(1)) : null,
      adjustedWeekProjection: Number(adjustedWeek.toFixed(1)),
      lineupUpgrade: Number(upgrade.toFixed(1)),
      projectedWinningBid,
      fairBid,
      recommendedBid,
      stretchBid,
      marketReachable,
      reasons,
      confidence: p.weekProjection && p.rosRank < 999 ? "medium" : "low"
    };
  }).sort((a, b) => b.recommendedBid - a.recommendedBid || b.lineupUpgrade - a.lineupUpgrade);
  return {
    id: `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: Date.now(),
    leagueId: profile.id || "",
    leagueName: profile.name || "League",
    week: currentWeek,
    teamsAlive,
    startingBudget,
    remainingBudget,
    calibrationVersion: FAAB_CALIBRATION_VERSION,
    assumptions: [
      "Projected winning bids use the 2025 Off With Their Heads history plus the Sep. 16, 2026 18-team and 12-team bid stacks.",
      "Competitor remaining budgets are not yet modeled; projected market prices use calibrated opening-budget shares with a modest season-phase adjustment.",
      "Schedule, injury, bye, role, and teammate-opportunity inputs are applied when supplied; missing fields use conservative defaults."
    ],
    recommendations
  };
}
__name(analyzeFaab, "analyzeFaab");
function flattenYahooMeta(value, out = {}) {
  if (Array.isArray(value)) value.forEach((v) => flattenYahooMeta(v, out));
  else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => {
    if (v == null || typeof v !== "object") out[k] = v;
    else if (k === "name" && v.full) out.name = v.full;
    else if (k === "bye_weeks" && v.week) out.bye_week = v.week;
    else flattenYahooMeta(v, out);
  });
  return out;
}
__name(flattenYahooMeta, "flattenYahooMeta");
function collectYahooEntities(value, entityName, found = []) {
  if (Array.isArray(value)) value.forEach((v) => collectYahooEntities(v, entityName, found));
  else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => {
    if (k === entityName) found.push(flattenYahooMeta(v));
    collectYahooEntities(v, entityName, found);
  });
  return found;
}
__name(collectYahooEntities, "collectYahooEntities");
async function yahooJson(token, endpoint) {
  const r = await fetch(`https://fantasysports.yahooapis.com/fantasy/v2/${endpoint}${endpoint.includes("?") ? "&" : "?"}format=json`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await r.text();
  if (!r.ok) throw new Error(`Yahoo API ${r.status}: ${text.slice(0, 240)}`);
  return JSON.parse(text);
}
__name(yahooJson, "yahooJson");
async function resolveYahooLeagueKey(token, profile) {
  if (profile.yahooLeagueKey) return profile.yahooLeagueKey;
  const raw = await yahooJson(token, "users;use_login=1/games;game_keys=nfl/leagues");
  const leagues = collectYahooEntities(raw, "league");
  const id = String(profile.yahooLeagueId || "");
  const byId = leagues.find((l) => id && String(l.league_key || "").endsWith(`.l.${id}`));
  const byName = leagues.find((l) => String(l.name || "").toLowerCase() === String(profile.name || "").toLowerCase());
  const hit = byId || byName;
  if (!hit || !hit.league_key) throw new Error("Could not match this Draft Lab profile to a connected Yahoo league.");
  return hit.league_key;
}
__name(resolveYahooLeagueKey, "resolveYahooLeagueKey");
function yahooPlayerRows(raw) {
  const seen = new Set();
  return collectYahooEntities(raw, "player").filter((p) => p.player_key && !seen.has(p.player_key) && seen.add(p.player_key)).map((p) => ({
    name: p.name || "Unknown",
    pos: p.display_position || p.position || "",
    team: p.editorial_team_abbr || "",
    status: p.status || "",
    bye_week: p.bye_week || "",
    notes: p.injury_note || ""
  }));
}
__name(yahooPlayerRows, "yahooPlayerRows");
function fantasyProsLeagueKey(value) {
  const raw = String(value || "").trim();
  let candidate = raw;
  try {
    if (/^https?:\/\//i.test(raw)) candidate = new URL(raw).searchParams.get("key") || raw;
  } catch {
  }
  return /^nfl~[0-9a-f-]{36}$/i.test(candidate) ? candidate : "";
}
__name(fantasyProsLeagueKey, "fantasyProsLeagueKey");
function fantasyProsPlayerRow(player, slot) {
  const ecrMatch = String(player && player.ecr || "").match(/(\d+)/);
  return {
    name: String(player && (player.full || player.player_name) || "").trim(),
    pos: String(player && (player.real_position || player.player_pos) || "").toUpperCase(),
    team: String(player && (player.real_team || player.player_team) || "").toUpperCase(),
    week_proj: n(player && (player.original_proj ?? player.week_proj), 0),
    ros_rank: ecrMatch ? Number(ecrMatch[1]) : "",
    status: String(player && (player.injuryStatus || player.injury_status) || "").toUpperCase(),
    schedule: n(player && player.sos, 3),
    opponent: String(player && player.opponent || ""),
    roster_slot: slot || String(player && player.position || ""),
    source: "fantasypros"
  };
}
__name(fantasyProsPlayerRow, "fantasyProsPlayerRow");
function normalizeFantasyProsMatchup(raw, profile = {}) {
  const matchup = raw && raw.matchup || {};
  const candidates = [matchup.team1, matchup.team2].filter(Boolean);
  const wanted = String(raw && raw.teamName || profile.meOwner || "").trim().toLowerCase();
  const team = candidates.find((t) => String(t.name || "").trim().toLowerCase() === wanted) || candidates[0];
  if (!team) throw new Error("FantasyPros returned no matchup roster for this league.");
  const starters = (team.starters || []).map((p) => fantasyProsPlayerRow(p, p.position || "START"));
  const bench = (team.bench || []).map((p) => fantasyProsPlayerRow(p, "BN"));
  const roster = [...starters, ...bench].filter((p) => p.name);
  if (!roster.length) throw new Error("FantasyPros returned an empty roster for this league.");
  return {
    fantasyProsLeagueKey: fantasyProsLeagueKey(raw && raw.key),
    syncedAt: Date.now(),
    teamName: team.name || raw.teamName || profile.meOwner || "",
    roster,
    available: [],
    lineup: { starters: starters.map((p) => p.name), bench: bench.map((p) => p.name) }
  };
}
__name(normalizeFantasyProsMatchup, "normalizeFantasyProsMatchup");
async function fantasyProsSnapshot(key, profile) {
  const validKey = fantasyProsLeagueKey(key);
  if (!validKey) throw new Error("FantasyPros MyPlaybook needs a valid NFL league URL or key.");
  const r = await fetch(`https://mpbnfl.fantasypros.com/json/matchup?key=${encodeURIComponent(validKey)}`, {
    headers: { "User-Agent": "aeo-draft-lab/1.0", Accept: "application/json" }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`FantasyPros MyPlaybook returned ${r.status}: ${text.slice(0, 180)}`);
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("FantasyPros MyPlaybook returned invalid JSON.");
  }
  return normalizeFantasyProsMatchup(raw, profile);
}
__name(fantasyProsSnapshot, "fantasyProsSnapshot");
function mergePlayerRows(primary, enrichment) {
  const extras = new Map((enrichment || []).map((p) => [String(p.name || "").trim().toLowerCase(), p]));
  return (primary || []).map((p) => {
    const extra = extras.get(String(p.name || "").trim().toLowerCase());
    return extra ? { ...extra, ...p, week_proj: p.week_proj || extra.week_proj, ros_rank: p.ros_rank || extra.ros_rank, schedule: p.schedule || extra.schedule, opponent: p.opponent || extra.opponent, status: p.status || extra.status } : p;
  });
}
__name(mergePlayerRows, "mergePlayerRows");
async function yahooFaabSnapshot(env, kv, originUrl, profile) {
  const token = await getYahooAccessToken(env, kv, originUrl);
  if (!token) throw new Error("Yahoo account is not connected.");
  const key = await resolveYahooLeagueKey(token, profile);
  const teamsRaw = await yahooJson(token, `league/${key}/teams`);
  const teams = collectYahooEntities(teamsRaw, "team").filter((t) => t.team_key);
  const mine = teams.find((t) => String(t.is_owned_by_current_login) === "1") || teams.find((t) => String(t.name || "").toLowerCase() === String(profile.meOwner || "").toLowerCase());
  if (!mine || !mine.team_key) throw new Error("Yahoo league matched, but the current user's team could not be identified.");
  const [rosterRaw, waiversRaw] = await Promise.all([
    yahooJson(token, `team/${mine.team_key}/roster`),
    yahooJson(token, `league/${key}/players;status=W;sort=OR;count=100`)
  ]);
  const roster = yahooPlayerRows(rosterRaw);
  const available = yahooPlayerRows(waiversRaw);
  if (!available.length) throw new Error("Yahoo returned no players currently on waivers; the eliminated roster may not be released yet.");
  return { yahooLeagueKey: key, syncedAt: Date.now(), roster, available };
}
__name(yahooFaabSnapshot, "yahooFaabSnapshot");
async function syncLeagueSnapshot(env, kv, originUrl, profile) {
  const config = await kv.get(leagueSourceConfigKey(profile.id), { type: "json" }) || {};
  const previous = await kv.get(leagueSnapshotKey(profile.id), { type: "json" }) || {};
  const sourceStatus = {};
  let yahoo = null;
  let fantasyPros = null;
  if (config.yahooEnabled !== false) {
    try {
      yahoo = await yahooFaabSnapshot(env, kv, originUrl, profile);
      sourceStatus.yahoo = { ok: true, syncedAt: yahoo.syncedAt };
    } catch (e) {
      sourceStatus.yahoo = { ok: false, error: e.message };
    }
  }
  if (config.fantasyProsEnabled !== false && config.fantasyProsLeagueKey) {
    try {
      fantasyPros = await fantasyProsSnapshot(config.fantasyProsLeagueKey, profile);
      sourceStatus.fantasypros = { ok: true, syncedAt: fantasyPros.syncedAt };
    } catch (e) {
      sourceStatus.fantasypros = { ok: false, error: e.message };
    }
  }
  let roster = yahoo && yahoo.roster && yahoo.roster.length ? yahoo.roster : fantasyPros && fantasyPros.roster && fantasyPros.roster.length ? fantasyPros.roster : previous.roster || [];
  if (fantasyPros && fantasyPros.roster && roster.length) roster = mergePlayerRows(roster, fantasyPros.roster);
  const available = yahoo && yahoo.available && yahoo.available.length ? yahoo.available : previous.available || [];
  const rosterSource = yahoo && yahoo.roster && yahoo.roster.length ? "yahoo" : fantasyPros && fantasyPros.roster && fantasyPros.roster.length ? "fantasypros" : previous.coverage && previous.coverage.roster || "saved";
  const availabilitySource = yahoo && yahoo.available && yahoo.available.length ? "yahoo" : previous.coverage && previous.coverage.available || (available.length ? "saved" : "none");
  if (!roster.length && !available.length) {
    const failures = Object.entries(sourceStatus).filter(([, s]) => !s.ok).map(([name, s]) => `${name}: ${s.error}`).join("; ");
    throw new Error(failures || "No configured data source returned league data.");
  }
  const snapshot = {
    leagueId: profile.id,
    leagueName: profile.name || "League",
    syncedAt: Date.now(),
    roster,
    available,
    lineup: fantasyPros && fantasyPros.lineup || previous.lineup || null,
    coverage: { roster: rosterSource, available: availabilitySource, projections: fantasyPros ? "fantasypros" : previous.coverage && previous.coverage.projections || "embedded" },
    sourceStatus
  };
  await kv.put(leagueSnapshotKey(profile.id), JSON.stringify(snapshot));
  return snapshot;
}
__name(syncLeagueSnapshot, "syncLeagueSnapshot");
async function saveInSeasonReport(kv, lg, report, me = null) {
  const reportKey = me ? scoped(inSeasonReportKey(lg, report.id), me) : inSeasonReportKey(lg, report.id);
  const reportsKey = me ? scoped(inSeasonReportsKey(lg), me) : inSeasonReportsKey(lg);
  await kv.put(reportKey, JSON.stringify(report));
  const idx = await kv.get(reportsKey, { type: "json" }) || [];
  idx.unshift({ id: report.id, createdAt: report.createdAt, week: report.week, count: report.recommendations.length, top: report.recommendations.slice(0, 3).map((p) => `${p.name} $${p.recommendedBid}`).join(", ") });
  await kv.put(reportsKey, JSON.stringify(idx.slice(0, 30)));
  return report;
}
__name(saveInSeasonReport, "saveInSeasonReport");
function reportEmailHtml(report) {
  const h = /* @__PURE__ */ __name((v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]), "h");
  const rows = report.recommendations.slice(0, 20).map((p) => `<tr><td>${h(p.name)}</td><td>${h(p.pos)}</td><td>$${p.recommendedBid}</td><td>$${p.projectedWinningBid}</td><td>$${p.stretchBid}</td><td>${h(p.reasons.join("; "))}</td></tr>`).join("");
  return `<h1>${h(report.leagueName)} — Week ${report.week} FAAB</h1><p>Budget remaining: $${report.remainingBudget}. Calibration: ${h(report.calibrationVersion)}</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Player</th><th>Pos</th><th>Bid</th><th>Projected win</th><th>Stretch</th><th>Why</th></tr></thead><tbody>${rows}</tbody></table><p>${h(report.assumptions.join(" "))}</p>`;
}
__name(reportEmailHtml, "reportEmailHtml");
async function emailInSeasonReport(env, to, report) {
  if (!env.RESEND_API_KEY || !env.FAAB_REPORT_FROM) return { sent: false, reason: "Email is not configured (RESEND_API_KEY and FAAB_REPORT_FROM are required)." };
  if (!to) return { sent: false, reason: "No report email address is configured." };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.FAAB_REPORT_FROM, to: [to], subject: `${report.leagueName} Week ${report.week} FAAB recommendations`, html: reportEmailHtml(report) })
  });
  if (!r.ok) throw new Error(`Email provider returned ${r.status}: ${(await r.text()).slice(0, 240)}`);
  return { sent: true };
}
__name(emailInSeasonReport, "emailInSeasonReport");
function pacificParts(date = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", hour12: false }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}
__name(pacificParts, "pacificParts");
async function runScheduledFaab(env) {
  if (!env.MOCKS) return;
  const local = pacificParts();
  if (local.weekday !== "Tue" || n(local.hour, -1) !== 1) return;
  const kv = env.MOCKS;
  const list = await kv.list({ prefix: "league:" });
  const profiles = (await Promise.all(list.keys.map((k) => kv.get(k.name, { type: "json" })))).filter((p) => p && p.leagueType === "guillotine");
  const originUrl = new URL(env.PUBLIC_ORIGIN || "https://aeo-draft-lab.hkeseyan.workers.dev");
  for (const profile of profiles) {
    const state = await kv.get(inSeasonStateKey(profile.id), { type: "json" }) || {};
    if (state.scheduleEnabled === false) continue;
    const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date());
    if (state.lastScheduledDate === dateKey) continue;
    let input = { ...state };
    try {
      const snapshot = await syncLeagueSnapshot(env, kv, originUrl, profile);
      input = { ...input, roster: snapshot.roster && snapshot.roster.length ? snapshot.roster : input.roster, available: snapshot.available && snapshot.available.length ? snapshot.available : input.available, dataSyncedAt: snapshot.syncedAt, dataCoverage: snapshot.coverage, dataSourceStatus: snapshot.sourceStatus };
    } catch (e) {
      input.dataSyncError = e.message;
    }
    if ((input.available && input.available.length) || String(input.availableCsv || "").trim()) {
      const report = await saveInSeasonReport(kv, profile.id, analyzeFaab(input, profile));
      if (state.emailEnabled) {
        try {
          report.email = await emailInSeasonReport(env, state.emailTo, report);
          await kv.put(inSeasonReportKey(profile.id, report.id), JSON.stringify(report));
        } catch (e) {
          report.email = { sent: false, reason: e.message };
          await kv.put(inSeasonReportKey(profile.id, report.id), JSON.stringify(report));
        }
      }
    }
    await kv.put(inSeasonStateKey(profile.id), JSON.stringify({ ...state, dataSyncedAt: input.dataSyncedAt || state.dataSyncedAt, dataCoverage: input.dataCoverage || state.dataCoverage, dataSourceStatus: input.dataSourceStatus || state.dataSourceStatus, dataSyncError: input.dataSyncError || "", lastScheduledDate: dateKey }));
  }
}
__name(runScheduledFaab, "runScheduledFaab");
async function runScheduledLeagueRefresh(env) {
  if (!env.MOCKS) return;
  const kv = env.MOCKS;
  const list = await kv.list({ prefix: "league:" });
  const profiles = (await Promise.all(list.keys.map((k) => kv.get(k.name, { type: "json" })))).filter(Boolean);
  const originUrl = new URL(env.PUBLIC_ORIGIN || "https://aeo-draft-lab.hkeseyan.workers.dev");
  for (const profile of profiles) {
    const config = await kv.get(leagueSourceConfigKey(profile.id), { type: "json" }) || {};
    if (config.enabled === false) continue;
    if (!config.fantasyProsLeagueKey && !profile.yahooLeagueId && !profile.yahooLeagueKey && profile.leagueType !== "guillotine") continue;
    try {
      await syncLeagueSnapshot(env, kv, originUrl, profile);
    } catch {
    }
  }
}
__name(runScheduledLeagueRefresh, "runScheduledLeagueRefresh");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/auth/google/start") {
      if (!ACCOUNTS_ON(env)) return new Response("Accounts aren't configured (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET secrets).", { status: 500 });
      const state = crypto.randomUUID();
      const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: googleRedirectUri(url),
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account"
      }).toString();
      return new Response(null, {
        status: 302,
        headers: { Location: authUrl, "Set-Cookie": setCookie(OAUTH_STATE_COOKIE, state, 600) }
      });
    }
    if (path === "/auth/google/callback") {
      if (!ACCOUNTS_ON(env)) return new Response("Accounts aren't configured.", { status: 500 });
      if (!env.MOCKS) return new Response("KV namespace 'MOCKS' is not bound.", { status: 500 });
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const expectedState = readCookie(request, OAUTH_STATE_COOKIE);
      if (!code) return new Response("Missing ?code from Google.", { status: 400 });
      if (!state || !expectedState || !safeEqual(state, expectedState)) {
        return new Response("Sign-in state mismatch \u2014 start again from the app.", { status: 400 });
      }
      try {
        const r = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: googleRedirectUri(url),
            grant_type: "authorization_code"
          }).toString()
        });
        if (!r.ok) throw new Error("Google token endpoint returned " + r.status + ": " + (await r.text()).slice(0, 300));
        const tok = await r.json();
        const payload = JSON.parse(b64urlDecode(String(tok.id_token || "").split(".")[1] || ""));
        if (!payload.sub) throw new Error("Google id_token had no subject claim.");
        const me = await upsertUser(env.MOCKS, {
          id: payload.sub,
          email: payload.email || "",
          name: payload.name || payload.email || "User",
          picture: payload.picture || ""
        });
        const headers = new Headers({ Location: "/" });
        headers.append("Set-Cookie", setCookie(SESSION_COOKIE, await signSession(env, me.id), SESSION_DAYS * 86400));
        headers.append("Set-Cookie", setCookie(OAUTH_STATE_COOKIE, "", 0));
        return new Response(null, { status: 302, headers });
      } catch (e) {
        return new Response("Google sign-in failed: " + e.message, { status: 500 });
      }
    }
    if (path === "/auth/signout") {
      return new Response(null, {
        status: 302,
        headers: { Location: "/", "Set-Cookie": setCookie(SESSION_COOKIE, "", 0) }
      });
    }
    if (path === "/auth/yahoo/start") {
      if (!env.YAHOO_CLIENT_ID) return new Response("Yahoo OAuth isn't configured (missing YAHOO_CLIENT_ID secret).", { status: 500 });
      const yme = env.MOCKS ? await currentUser(request, env, env.MOCKS) : null;
      if (!yme || !yme.admin) return new Response("Only the admin can connect a Yahoo account.", { status: 403 });
      const authUrl = "https://api.login.yahoo.com/oauth2/request_auth?" + new URLSearchParams({
        client_id: env.YAHOO_CLIENT_ID,
        redirect_uri: yahooRedirectUri(url),
        response_type: "code",
        language: "en-us"
      }).toString();
      return Response.redirect(authUrl, 302);
    }
    if (path === "/auth/yahoo/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing ?code from Yahoo.", { status: 400 });
      if (!env.MOCKS) return new Response("KV namespace 'MOCKS' is not bound.", { status: 500 });
      try {
        const tok = await yahooTokenRequest(env, {
          grant_type: "authorization_code",
          redirect_uri: yahooRedirectUri(url),
          code
        });
        await env.MOCKS.put(YAHOO_AUTH_KEY, JSON.stringify({
          access_token: tok.access_token,
          refresh_token: tok.refresh_token,
          expires_at: Date.now() + tok.expires_in * 1e3,
          // When the *grant* was made, not when the token was last refreshed. A
          // refresh preserves the scopes of the original consent, so a grant
          // made before the Yahoo app had Fantasy Sports permission stays
          // permission-less no matter how many times it is refreshed. This
          // timestamp is what tells us to stop refreshing and re-consent.
          connected_at: Date.now()
        }));
        return new Response("Yahoo account connected. You can close this tab and go back to the app's Leagues tab.", { headers: { "Content-Type": "text/plain" } });
      } catch (e) {
        return new Response("Yahoo auth failed: " + e.message, { status: 500 });
      }
    }
    if (path.startsWith("/api/")) {
      if (request.method === "OPTIONS") return J({}, 204);
      if (!authed(request, env)) return J({ error: "unauthorized" }, 401);
      if (!env.MOCKS) return J({ error: "KV namespace 'MOCKS' is not bound." }, 500);
      const kv = env.MOCKS;
      const lg = leagueId(url);
      const me = await currentUser(request, env, kv);
      if (path === "/api/me") {
        if (request.method === "GET") {
          return J({
            accountsEnabled: ACCOUNTS_ON(env),
            signedIn: !!me && !me.accountsOff,
            admin: !!(me && me.admin),
            user: me && !me.accountsOff ? { id: me.id, email: me.email, name: me.name, picture: me.picture } : null
          });
        }
        return J({ error: "method" }, 405);
      }
      if (!me) return J({ error: "sign-in required" }, 401);
      const requireAdmin = /* @__PURE__ */ __name(() => me.admin ? null : J({ error: "admin only" }, 403), "requireAdmin");
      if (path === "/api/users") {
        const denied = requireAdmin();
        if (denied) return denied;
        if (request.method === "GET") return J(await kv.get(USERS_INDEX, { type: "json" }) || []);
        return J({ error: "method" }, 405);
      }
      if (path === "/api/setup") {
        if (request.method === "GET") {
          const s = await kv.get(scoped(setupKey(lg), me), { type: "json" });
          return J(s || {});
        }
        if (request.method === "PUT") {
          let b;
          try {
            b = await request.json();
          } catch {
            return J({ error: "bad json" }, 400);
          }
          const prev = await kv.get(scoped(setupKey(lg), me), { type: "json" });
          if (prev) {
            const hist = await kv.get(scoped(historyKey(lg), me), { type: "json" }) || [];
            hist.unshift({ ts: Date.now(), data: prev });
            await kv.put(scoped(historyKey(lg), me), JSON.stringify(hist.slice(0, 30)));
          }
          await kv.put(scoped(setupKey(lg), me), JSON.stringify(b));
          return J({ ok: true });
        }
        return J({ error: "method" }, 405);
      }
      if (path === "/api/setup/history") {
        if (request.method === "GET") {
          return J(await kv.get(scoped(historyKey(lg), me), { type: "json" }) || []);
        }
        return J({ error: "method" }, 405);
      }
      if (path === "/api/setup/restore") {
        if (request.method === "POST") {
          let b;
          try {
            b = await request.json();
          } catch {
            return J({ error: "bad json" }, 400);
          }
          const hist = await kv.get(scoped(historyKey(lg), me), { type: "json" }) || [];
          const entry = hist.find((h) => h.ts === b.ts);
          if (!entry) return J({ error: "snapshot not found" }, 404);
          const current = await kv.get(scoped(setupKey(lg), me), { type: "json" });
          if (current) hist.unshift({ ts: Date.now(), data: current });
          await kv.put(scoped(historyKey(lg), me), JSON.stringify(hist.slice(0, 30)));
          await kv.put(scoped(setupKey(lg), me), JSON.stringify(entry.data));
          return J(entry.data);
        }
        return J({ error: "method" }, 405);
      }
      if (path === "/api/commish") {
        const denied = requireAdmin();
        if (denied) return denied;
        if (request.method === "GET") {
          const s = await kv.get(commishKey(lg), { type: "json" });
          return J(s || {});
        }
        if (request.method === "PUT") {
          let b;
          try {
            b = await request.json();
          } catch {
            return J({ error: "bad json" }, 400);
          }
          const prev = await kv.get(commishKey(lg), { type: "json" });
          if (prev) {
            const hist = await kv.get(commishHistoryKey(lg), { type: "json" }) || [];
            hist.unshift({ ts: Date.now(), data: prev });
            await kv.put(commishHistoryKey(lg), JSON.stringify(hist.slice(0, 30)));
          }
          await kv.put(commishKey(lg), JSON.stringify(b));
          return J({ ok: true });
        }
        return J({ error: "method" }, 405);
      }
      if (path === "/api/commish/history") {
        const denied = requireAdmin();
        if (denied) return denied;
        if (request.method === "GET") {
          return J(await kv.get(commishHistoryKey(lg), { type: "json" }) || []);
        }
        return J({ error: "method" }, 405);
      }
      if (path === "/api/commish/restore") {
        const denied = requireAdmin();
        if (denied) return denied;
        if (request.method === "POST") {
          let b;
          try {
            b = await request.json();
          } catch {
            return J({ error: "bad json" }, 400);
          }
          const hist = await kv.get(commishHistoryKey(lg), { type: "json" }) || [];
          const entry = hist.find((h) => h.ts === b.ts);
          if (!entry) return J({ error: "snapshot not found" }, 404);
          const current = await kv.get(commishKey(lg), { type: "json" });
          if (current) hist.unshift({ ts: Date.now(), data: current });
          await kv.put(commishHistoryKey(lg), JSON.stringify(hist.slice(0, 30)));
          await kv.put(commishKey(lg), JSON.stringify(entry.data));
          return J(entry.data);
        }
        return J({ error: "method" }, 405);
      }
      if (path === "/api/mocks") {
        if (request.method === "GET") {
          return J(await kv.get(scoped(mocksIndexKey(lg), me), { type: "json" }) || []);
        }
        if (request.method === "POST") {
          let b;
          try {
            b = await request.json();
          } catch {
            return J({ error: "bad json" }, 400);
          }
          const id = Date.now().toString(36) + "-" + crypto.randomUUID().slice(0, 8);
          const ts = Date.now();
          const name = b.name && String(b.name).slice(0, 80) || "Mock " + new Date(ts).toISOString().slice(0, 16).replace("T", " ");
          const summary = b.summary && String(b.summary).slice(0, 300) || "";
          const rec = { id, name, ts, summary, data: b.data || {} };
          await kv.put(scoped(mockRecordKey(lg, id), me), JSON.stringify(rec));
          const idx = await kv.get(scoped(mocksIndexKey(lg), me), { type: "json" }) || [];
          idx.unshift({ id, name, ts, summary });
          await kv.put(scoped(mocksIndexKey(lg), me), JSON.stringify(idx.slice(0, 500)));
          return J({ ok: true, id, name, ts, summary });
        }
        return J({ error: "method" }, 405);
      }
      if (path.startsWith("/api/mocks/")) {
        const id = path.split("/").pop();
        if (request.method === "GET") {
          const rec = await kv.get(scoped(mockRecordKey(lg, id), me), { type: "json" });
          return rec ? J(rec) : J({ error: "not found" }, 404);
        }
        if (request.method === "DELETE") {
          await kv.delete(scoped(mockRecordKey(lg, id), me));
          const idx = (await kv.get(scoped(mocksIndexKey(lg), me), { type: "json" }) || []).filter((x) => x.id !== id);
          await kv.put(scoped(mocksIndexKey(lg), me), JSON.stringify(idx));
          return J({ ok: true });
        }
        return J({ error: "method" }, 405);
      }
      if (path === "/api/leagues") {
        if (request.method !== "GET") {
          const denied = requireAdmin();
          if (denied) return denied;
        }
        if (request.method === "GET") {
          const list = await kv.list({ prefix: "league:" });
          const profiles = await Promise.all(list.keys.map((k) => kv.get(k.name, { type: "json" })));
          return J(profiles.filter(Boolean));
        }
        if (request.method === "POST") {
          let b;
          try {
            b = await request.json();
          } catch {
            return J({ error: "bad json" }, 400);
          }
          const name = b.name && String(b.name).trim() || "New League";
          const base = slugify(name);
          let id = base, n = 2;
          while (await kv.get(leagueProfileKey(id))) {
            id = `${base}-${n++}`;
          }
          const profile = { ...b, id, name };
          await kv.put(leagueProfileKey(id), JSON.stringify(profile));
          return J(profile, 201);
        }
        return J({ error: "method" }, 405);
      }
      if (/^\/api\/leagues\/[^/]+\/history$/.test(path)) {
        if (request.method !== "GET") return J({ error: "method" }, 405);
        const id = decodeURIComponent(path.split("/")[3]);
        return J(await kv.get(leagueHistoryKey(id), { type: "json" }) || []);
      }
      if (/^\/api\/leagues\/[^/]+\/restore$/.test(path)) {
        if (request.method !== "POST") return J({ error: "method" }, 405);
        const id = decodeURIComponent(path.split("/")[3]);
        let b;
        try {
          b = await request.json();
        } catch {
          return J({ error: "bad json" }, 400);
        }
        const hist = await kv.get(leagueHistoryKey(id), { type: "json" }) || [];
        const entry = hist.find((h) => h.ts === b.ts);
        if (!entry) return J({ error: "snapshot not found" }, 404);
        const current = await kv.get(leagueProfileKey(id), { type: "json" });
        if (current) hist.unshift({ ts: Date.now(), data: current });
        await kv.put(leagueHistoryKey(id), JSON.stringify(hist.slice(0, 30)));
        await kv.put(leagueProfileKey(id), JSON.stringify(entry.data));
        return J(entry.data);
      }
      if (path.startsWith("/api/leagues/")) {
        const denied = requireAdmin();
        if (denied) return denied;
        const id = decodeURIComponent(path.split("/").pop());
        if (request.method === "PUT") {
          let b;
          try {
            b = await request.json();
          } catch {
            return J({ error: "bad json" }, 400);
          }
          const profile = { ...b, id };
          const prev = await kv.get(leagueProfileKey(id), { type: "json" });
          if (prev) {
            const hist = await kv.get(leagueHistoryKey(id), { type: "json" }) || [];
            hist.unshift({ ts: Date.now(), data: prev });
            await kv.put(leagueHistoryKey(id), JSON.stringify(hist.slice(0, 30)));
          }
          await kv.put(leagueProfileKey(id), JSON.stringify(profile));
          return J(profile);
        }
        if (request.method === "DELETE") {
          if (id === "aeo-keepers") return J({ error: "cannot delete aeo-keepers" }, 400);
          await kv.delete(leagueProfileKey(id));
          await kv.delete(leagueHistoryKey(id));
          await kv.delete(setupKey(id));
          await kv.delete(historyKey(id));
          await kv.delete(mocksIndexKey(id));
          await kv.delete(inSeasonStateKey(id));
          await kv.delete(inSeasonReportsKey(id));
          const mockList = await kv.list({ prefix: `mock:${id}:` });
          const reportList = await kv.list({ prefix: `inseasonReport:${id}:` });
          await Promise.all([...mockList.keys, ...reportList.keys].map((k) => kv.delete(k.name)));
          return J({ ok: true });
        }
        return J({ error: "method" }, 405);
      }
      if (path === "/api/nhl/schedule") {
        if (request.method !== "GET") return J({ error: "method" }, 405);
        const start = url.searchParams.get("start") || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const days = Math.min(21, Math.max(1, Number(url.searchParams.get("days")) || 7));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return J({ error: "start must be YYYY-MM-DD" }, 400);
        const cacheKey = `nhl:sched:${start}:${days}`;
        const cached = await kv.get(cacheKey, { type: "json" });
        if (cached) return J(cached);
        try {
          // NHL's endpoint answers with one game-week per call and hands back the
          // next week's start date, so walk it until `days` are covered. gameType 2
          // is regular season — preseason and playoffs don't score in fantasy.
          const byDate = {};
          let cursor = start;
          let seasonStart = null;
          for (let i = 0; i < 4 && Object.keys(byDate).length < days; i++) {
            const r = await fetch(`https://api-web.nhle.com/v1/schedule/${cursor}`);
            if (!r.ok) return J({ error: "NHL API returned " + r.status }, 502);
            const d = await r.json();
            if (seasonStart === null) seasonStart = d.regularSeasonStartDate || null;
            (d.gameWeek || []).forEach((day) => {
              if (byDate[day.date]) return;
              byDate[day.date] = (day.games || []).filter((g) => g.gameType === 2).map((g) => [g.awayTeam && g.awayTeam.abbrev, g.homeTeam && g.homeTeam.abbrev]);
            });
            if (!d.nextStartDate || d.nextStartDate === cursor) break;
            cursor = d.nextStartDate;
          }
          const dates = Object.keys(byDate).sort().slice(0, days);
          const teams = {};
          const dayCounts = {};
          dates.forEach((date) => {
            const games = byDate[date] || [];
            dayCounts[date] = games.length;
            games.forEach((pair) => pair.forEach((ab) => {
              if (!ab) return;
              (teams[ab] = teams[ab] || []).push(date);
            }));
          });
          const out = { start, seasonStart, days: dates, dayCounts, teams };
          await kv.put(cacheKey, JSON.stringify(out), { expirationTtl: 6 * 60 * 60 });
          return J(out);
        } catch (e) {
          return J({ error: "NHL schedule fetch failed: " + e.message }, 502);
        }
      }
      if (path.startsWith("/api/import/sleeper/")) {
        const denied = requireAdmin();
        if (denied) return denied;
        if (request.method !== "GET") return J({ error: "method" }, 405);
        const sleeperId = decodeURIComponent(path.split("/").pop());
        try {
          const [league, rosters, users] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${sleeperId}`).then((r) => r.json()),
            fetch(`https://api.sleeper.app/v1/league/${sleeperId}/rosters`).then((r) => r.json()),
            fetch(`https://api.sleeper.app/v1/league/${sleeperId}/users`).then((r) => r.json())
          ]);
          if (!league || league.error) return J({ error: "Sleeper league not found" }, 404);
          let players = await kv.get("sleeper:players:cache", { type: "json" });
          const cachedAt = await kv.get("sleeper:players:ts");
          const stale = !cachedAt || Date.now() - Number(cachedAt) > 24 * 60 * 60 * 1e3;
          if (!players || stale) {
            players = await fetch("https://api.sleeper.app/v1/players/nfl").then((r) => r.json());
            await kv.put("sleeper:players:cache", JSON.stringify(players));
            await kv.put("sleeper:players:ts", String(Date.now()));
          }
          const nameFor = /* @__PURE__ */ __name((userId, rosterId) => {
            const u = (users || []).find((x) => x.user_id === userId);
            return u && (u.display_name || u.username) || `Team ${rosterId}`;
          }, "nameFor");
          const owners = [];
          const ownerSlot = {};
          const rosterLines = [];
          (rosters || []).forEach((r) => {
            const owner = nameFor(r.owner_id, r.roster_id);
            if (!owners.includes(owner)) owners.push(owner);
            ownerSlot[owner] = r.roster_id;
            const keeperIds = new Set((r.keepers || []).map(String));
            (r.players || []).forEach((pid) => {
              const meta = players ? players[pid] : null;
              const name = meta ? `${meta.first_name || ""} ${meta.last_name || ""}`.trim() : String(pid);
              const keeper = keeperIds.has(String(pid)) ? "1" : "NONE";
              rosterLines.push(`${owner}|${name}|FA|${keeper}`);
            });
          });
          return J({
            name: league.name || "Imported League",
            teams: league.total_rosters || owners.length || 12,
            owners,
            ownerSlot,
            rostersRaw: rosterLines.join("\n"),
            _source: "sleeper",
            _sleeperLeagueId: sleeperId,
            _note: "Structure only \u2014 review draft type, superflex, scoring, keeper rules, and dates before saving. Keeper flags reflect Sleeper's keeper list where available; drafted round is not tracked by Sleeper so it's marked FA."
          });
        } catch (e) {
          return J({ error: "Sleeper import failed: " + e.message }, 502);
        }
      }
      if (path.startsWith("/api/import/mfl/")) {
        const denied = requireAdmin();
        if (denied) return denied;
        if (request.method !== "GET") return J({ error: "method" }, 405);
        const mflId = decodeURIComponent(path.split("/").pop());
        const year = url.searchParams.get("year") || String((/* @__PURE__ */ new Date()).getFullYear());
        const mflGet = /* @__PURE__ */ __name((type) => fetch(`https://api.myfantasyleague.com/${year}/export?TYPE=${type}&L=${mflId}&JSON=1`, {
          headers: { "User-Agent": "aeo-draft-lab/1.0" }
        }).then((r) => r.json()), "mflGet");
        try {
          const [leagueData, rostersData] = await Promise.all([mflGet("league"), mflGet("rosters")]);
          const league = leagueData && leagueData.league;
          if (!league || leagueData.error) return J({ error: "MFL league not found" }, 404);
          const playersCacheKey = `mfl:players:${year}`;
          let players = await kv.get(playersCacheKey, { type: "json" });
          const cachedAt = await kv.get(`${playersCacheKey}:ts`);
          const stale = !cachedAt || Date.now() - Number(cachedAt) > 24 * 60 * 60 * 1e3;
          if (!players) {
            const pd = await mflGet("players");
            const list = pd && pd.players && pd.players.player || [];
            players = {};
            list.forEach((p) => {
              players[p.id] = p;
            });
            await kv.put(playersCacheKey, JSON.stringify(players));
            await kv.put(`${playersCacheKey}:ts`, String(Date.now()));
          } else if (stale) {
            ctx.waitUntil(mflGet("players").then((pd) => {
              const list = pd && pd.players && pd.players.player || [];
              const fresh = {};
              list.forEach((p) => {
                fresh[p.id] = p;
              });
              return Promise.all([
                kv.put(playersCacheKey, JSON.stringify(fresh)),
                kv.put(`${playersCacheKey}:ts`, String(Date.now()))
              ]);
            }));
          }
          const nameFor = /* @__PURE__ */ __name((id) => {
            const p = players[id];
            if (!p) return `Player ${id}`;
            const [last, first] = String(p.name || "").split(",").map((s) => s.trim());
            return first ? `${first} ${last}` : p.name || `Player ${id}`;
          }, "nameFor");
          const divisionDefs = league.conferences && league.conferences.conference && league.conferences.conference.length && league.conferences.conference || league.divisions && league.divisions.division || [];
          const franchisesAll = league.franchises && league.franchises.franchise || [];
          const requestedDivision = url.searchParams.get("division");
          if (divisionDefs.length > 1 && !requestedDivision) {
            const counts = {};
            franchisesAll.forEach((f) => {
              counts[f.division] = (counts[f.division] || 0) + 1;
            });
            return J({
              name: league.name || "Imported League",
              needsDivision: true,
              divisions: divisionDefs.map((d) => ({ id: d.id, name: d.name, teams: counts[d.id] || 0 })),
              _note: "This league has multiple divisions/conferences, each independently drafted/managed. Pick one to import as its own league profile \u2014 re-request with ?division=<id>."
            });
          }
          const franchises = requestedDivision ? franchisesAll.filter((f) => f.division === requestedDivision) : franchisesAll;
          const divisionName = requestedDivision ? (divisionDefs.find((d) => d.id === requestedDivision) || {}).name || requestedDivision : null;
          const ownerById = {};
          const owners = [];
          const ownerSlot = {};
          franchises.forEach((f, i) => {
            const owner = f.name || `Team ${f.id}`;
            ownerById[f.id] = owner;
            owners.push(owner);
            ownerSlot[owner] = i + 1;
          });
          const rosterFranchises = (rostersData && rostersData.rosters && rostersData.rosters.franchise || []).filter(
            (f) => ownerById[f.id]
          );
          const rosterLines = [];
          rosterFranchises.forEach((f) => {
            const owner = ownerById[f.id];
            const list = f.player ? Array.isArray(f.player) ? f.player : [f.player] : [];
            list.forEach((p) => {
              rosterLines.push(`${owner}|${nameFor(p.id)}|FA|NONE`);
            });
          });
          return J({
            name: divisionName ? `${league.name || "Imported League"} \u2014 ${divisionName}` : league.name || "Imported League",
            teams: franchises.length || 12,
            owners,
            ownerSlot,
            rostersRaw: rosterLines.join("\n"),
            _source: "mfl",
            _mflLeagueId: mflId,
            _mflYear: year,
            _mflDivision: requestedDivision || null,
            _note: "Structure only \u2014 review draft type, superflex, scoring, keeper rules, and dates before saving. MFL doesn't expose a keeper flag or draft round via this export, so every player comes back FA/NONE \u2014 set keepers on Teams & Keepers after saving."
          });
        } catch (e) {
          return J({ error: "MFL import failed: " + e.message }, 502);
        }
      }
      if (path === "/api/data-sources/sync") {
        const denied = requireAdmin();
        if (denied) return denied;
        if (request.method !== "POST") return J({ error: "method" }, 405);
        const profile = await kv.get(leagueProfileKey(lg), { type: "json" });
        if (!profile) return J({ error: "league profile not found" }, 404);
        try {
          return J(await syncLeagueSnapshot(env, kv, url, profile), 201);
        } catch (e) {
          return J({ error: e.message }, 502);
        }
      }
      if (path === "/api/data-sources") {
        const denied = requireAdmin();
        if (denied) return denied;
        const configKey = leagueSourceConfigKey(lg);
        if (request.method === "GET") {
          const config = await kv.get(configKey, { type: "json" }) || {};
          const snapshot = await kv.get(leagueSnapshotKey(lg), { type: "json" });
          return J({
            enabled: config.enabled !== false,
            yahooEnabled: config.yahooEnabled !== false,
            fantasyProsEnabled: config.fantasyProsEnabled !== false,
            fantasyProsConfigured: !!config.fantasyProsLeagueKey,
            syncedAt: snapshot && snapshot.syncedAt || null,
            coverage: snapshot && snapshot.coverage || null,
            sourceStatus: snapshot && snapshot.sourceStatus || null
          });
        }
        if (request.method === "PUT") {
          let b;
          try {
            b = await request.json();
          } catch {
            return J({ error: "bad json" }, 400);
          }
          const existing = await kv.get(configKey, { type: "json" }) || {};
          const supplied = b.fantasyProsUrlOrKey || b.fantasyProsLeagueKey || "";
          const parsed = supplied ? fantasyProsLeagueKey(supplied) : "";
          if (supplied && !parsed) return J({ error: "Paste a valid FantasyPros NFL MyPlaybook league URL or nfl~ league key." }, 400);
          const config = {
            ...existing,
            enabled: b.enabled == null ? existing.enabled !== false : !!b.enabled,
            yahooEnabled: b.yahooEnabled == null ? existing.yahooEnabled !== false : !!b.yahooEnabled,
            fantasyProsEnabled: b.fantasyProsEnabled == null ? existing.fantasyProsEnabled !== false : !!b.fantasyProsEnabled,
            updatedAt: Date.now()
          };
          if (parsed) config.fantasyProsLeagueKey = parsed;
          if (b.clearFantasyProsKey) delete config.fantasyProsLeagueKey;
          await kv.put(configKey, JSON.stringify(config));
          return J({ ok: true, fantasyProsConfigured: !!config.fantasyProsLeagueKey });
        }
        return J({ error: "method" }, 405);
      }
      if (path === "/api/league-data") {
        if (request.method !== "GET") return J({ error: "method" }, 405);
        const snapshot = await kv.get(leagueSnapshotKey(lg), { type: "json" });
        return snapshot ? J(snapshot) : J({ error: "no league snapshot yet" }, 404);
      }
      if (path === "/api/inseason/state") {
        const key = scoped(inSeasonStateKey(lg), me);
        if (request.method === "GET") {
          const state = await kv.get(key, { type: "json" }) || {};
          return J({ ...state, emailDefault: state.emailTo || me.email || "" });
        }
        if (request.method === "PUT") {
          let b;
          try {
            b = await request.json();
          } catch {
            return J({ error: "bad json" }, 400);
          }
          const state = {
            ...b,
            week: Math.max(1, n(b.week, 1)),
            startingBudget: Math.max(1, n(b.startingBudget, 1e3)),
            remainingBudget: Math.max(0, n(b.remainingBudget, 1e3)),
            teamsAlive: Math.max(2, n(b.teamsAlive, 12)),
            aggression: clamp(n(b.aggression, 0.8), 0.4, 1.1),
            timezone: "America/Los_Angeles",
            updatedAt: Date.now()
          };
          await kv.put(key, JSON.stringify(state));
          return J(state);
        }
        return J({ error: "method" }, 405);
      }
      if (path === "/api/inseason/reports") {
        const reportsKey = scoped(inSeasonReportsKey(lg), me);
        if (request.method === "GET") return J(await kv.get(reportsKey, { type: "json" }) || []);
        if (request.method === "POST") {
          let b;
          try {
            b = await request.json();
          } catch {
            return J({ error: "bad json" }, 400);
          }
          const profile = await kv.get(leagueProfileKey(lg), { type: "json" });
          if (!profile) return J({ error: "league profile not found" }, 404);
          const stateKey = scoped(inSeasonStateKey(lg), me);
          const saved = await kv.get(stateKey, { type: "json" }) || {};
          let input = { ...saved, ...b };
          if (b.syncSources || b.syncYahoo) {
            const denied = requireAdmin();
            if (denied) return denied;
            try {
              const snapshot = await syncLeagueSnapshot(env, kv, url, profile);
              input = { ...input, roster: snapshot.roster && snapshot.roster.length ? snapshot.roster : input.roster, available: snapshot.available && snapshot.available.length ? snapshot.available : input.available, dataSyncedAt: snapshot.syncedAt, dataCoverage: snapshot.coverage, dataSourceStatus: snapshot.sourceStatus, dataSyncError: "" };
            } catch (e) {
              return J({ error: e.message, fallback: "Use the most recent saved snapshot or paste the roster and waiver pool CSV, then run without source sync." }, 502);
            }
          }
          const report = await saveInSeasonReport(kv, lg, analyzeFaab(input, profile), me);
          const nextState = { ...saved, ...b, dataSyncedAt: input.dataSyncedAt || saved.dataSyncedAt, dataCoverage: input.dataCoverage || saved.dataCoverage, dataSourceStatus: input.dataSourceStatus || saved.dataSourceStatus, dataSyncError: input.dataSyncError || "", updatedAt: Date.now() };
          delete nextState.syncYahoo;
          delete nextState.syncSources;
          if (input.roster) nextState.roster = input.roster;
          if (input.available) nextState.available = input.available;
          await kv.put(stateKey, JSON.stringify(nextState));
          return J(report, 201);
        }
        return J({ error: "method" }, 405);
      }
      if (/^\/api\/inseason\/reports\/[^/]+$/.test(path)) {
        if (request.method !== "GET") return J({ error: "method" }, 405);
        const id = decodeURIComponent(path.split("/").pop());
        const report = await kv.get(scoped(inSeasonReportKey(lg, id), me), { type: "json" });
        return report ? J(report) : J({ error: "report not found" }, 404);
      }
      if (path === "/api/inseason/email") {
        if (request.method !== "POST") return J({ error: "method" }, 405);
        let b;
        try {
          b = await request.json();
        } catch {
          return J({ error: "bad json" }, 400);
        }
        const idx = await kv.get(scoped(inSeasonReportsKey(lg), me), { type: "json" }) || [];
        const id = b.id || idx[0] && idx[0].id;
        if (!id) return J({ error: "no report to email" }, 404);
        const report = await kv.get(scoped(inSeasonReportKey(lg, id), me), { type: "json" });
        if (!report) return J({ error: "report not found" }, 404);
        try {
          return J(await emailInSeasonReport(env, b.to || me.email, report));
        } catch (e) {
          return J({ error: e.message }, 502);
        }
      }
      if (path === "/api/yahoo/status") {
        const denied = requireAdmin();
        if (denied) return denied;
        if (request.method !== "GET") return J({ error: "method" }, 405);
        const auth = await kv.get(YAHOO_AUTH_KEY, { type: "json" });
        const cid = env.YAHOO_CLIENT_ID || "";
        return J({
          connected: !!auth,
          connected_at: auth ? auth.connected_at || null : null,
          expires_at: auth ? auth.expires_at || null : null,
          client_id_hint: cid ? `${cid.slice(0, 12)}\u2026${cid.slice(-8)} (${cid.length} chars)` : null
        });
      }
      if (path === "/api/yahoo/disconnect") {
        const denied = requireAdmin();
        if (denied) return denied;
        if (request.method !== "POST") return J({ error: "method" }, 405);
        await kv.delete(YAHOO_AUTH_KEY);
        return J({ ok: true });
      }
      if (path === "/api/yahoo/leagues") {
        const denied = requireAdmin();
        if (denied) return denied;
        if (request.method !== "GET") return J({ error: "method" }, 405);
        try {
          const token = await getYahooAccessToken(env, kv, url);
          if (!token) return J({ error: "Yahoo account not connected. Visit /auth/yahoo/start first." }, 401);
          const r = await fetch(
            "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nfl/leagues?format=json",
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const text = await r.text();
          if (!r.ok) {
            const needsPerm = /additional_authorization_required/.test(text);
            return J({
              error: needsPerm ? "Yahoo says this app isn't authorized for Fantasy Sports data." : "Yahoo API returned " + r.status,
              hint: needsPerm ? "In the Yahoo Developer console, open this app, tick Fantasy Sports \u2192 Read under API Permissions, save, then click Connect Yahoo account again to re-consent." : void 0,
              body: text.slice(0, 1e3)
            }, 502);
          }
          let raw;
          try {
            raw = JSON.parse(text);
          } catch {
            return J({ error: "Yahoo response wasn't valid JSON", body: text.slice(0, 1e3) }, 502);
          }
          let leagues = [];
          try {
            const games = raw.fantasy_content.users[0].user[1].games;
            for (const gk of Object.keys(games)) {
              if (gk === "count") continue;
              const game = games[gk].game;
              const leaguesObj = game[1] && game[1].leagues || {};
              for (const lk of Object.keys(leaguesObj)) {
                if (lk === "count") continue;
                const league = leaguesObj[lk].league[0];
                leagues.push({ key: league.league_key, name: league.name, season: league.season });
              }
            }
          } catch (e) {
            leagues = null;
          }
          return J({ leagues, raw });
        } catch (e) {
          return J({ error: "Yahoo leagues request failed: " + e.message }, 502);
        }
      }
      return J({ error: "not found" }, 404);
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await runScheduledLeagueRefresh(env);
      await runScheduledFaab(env);
    })());
  }
};
export {
  analyzeFaab,
  fantasyProsLeagueKey,
  normalizeFantasyProsMatchup,
  parseCsvObjects,
  worker_default as default
};
//# sourceMappingURL=worker.js.map

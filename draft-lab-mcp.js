// Private, read-only MCP bridge for Draft Lab's authenticated Yahoo trade data.
// OAuth tokens are opaque, SHA-256 indexed in KV, user-bound, short-lived, scoped,
// and never contain Yahoo credentials. ChatGPT is the only allowed OAuth client.
const CLIENT = "https://chatgpt.com/oauth/client.json";
const REDIRECT = "https://chatgpt.com/connector_platform_oauth_redirect";
const SCOPE = "trades:read";
const CONTEXT_SCOPE = "trade-context:read";
const SCOPES = [SCOPE, CONTEXT_SCOPE];
const SUPPORTED_PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26"];
const CONSENT_COOKIE = "aeo_mcp_consent";
const RETURN_COOKIE = "aeo_mcp_return";
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const AUTH_TTL = 120;
const ACCESS_TTL = 3600;
const REFRESH_TTL = 2592000;
function response(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: { ...JSON_HEADERS, ...extra } });
}
function html(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff", ...extra
  } });
}
function randomToken() {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  return [...raw].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function pkce(verifier) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function cookie(req, key) {
  const raw = req.headers.get("cookie") || "";
  const found = raw.split(";").map(x => x.trim()).find(x => x.startsWith(key + "="));
  if (!found) return "";
  try { return decodeURIComponent(found.substring(key.length + 1)); } catch { return ""; }
}
function setCookie(key, value, age, sameSite = "Lax") {
  return key + "=" + encodeURIComponent(value) + "; Path=/; Secure; HttpOnly; SameSite=" + sameSite + "; Max-Age=" + age;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function redirect(uri, cookies = []) {
  const headers = new Headers({ Location: uri, "Cache-Control": "no-store" });
  for (const item of cookies) headers.append("Set-Cookie", item);
  return new Response(null, { status: 302, headers });
}
function OAuthError(name, code = 400) {
  return response({ error: name }, code);
}
function parseScopes(value) {
  const scopes = String(value || "").split(/\s+/).filter(Boolean);
  if (!scopes.length || scopes.some(scope => !SCOPES.includes(scope))) return null;
  return SCOPES.filter(scope => scopes.includes(scope)).join(" ");
}

function authorizeParameters(url, origin) {
  const q = url.searchParams;
  const resource = origin + "/mcp";
  if (q.get("client_id") !== CLIENT || q.get("redirect_uri") !== REDIRECT) return null;
  if (q.get("response_type") !== "code" || q.get("code_challenge_method") !== "S256") return null;
  const challenge = q.get("code_challenge") || "";
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) return null;
  if (q.get("resource") !== resource) return null;
  const scope = parseScopes(q.get("scope"));
  if (!scope || !scope.split(" ").includes(SCOPE)) return null;
  const state = q.get("state") || "";
  if (state.length > 2048) return null;
  return { clientId: CLIENT, redirectUri: REDIRECT, resource, challenge, state, scope };
}
function responseToClient(params, origin, additional) {
  const target = new URL(params.redirectUri);
  for (const [key, value] of Object.entries(additional)) if (value != null) target.searchParams.set(key, value);
  if (params.state) target.searchParams.set("state", params.state);
  target.searchParams.set("iss", origin);
  return redirect(target.toString(), [setCookie(CONSENT_COOKIE, "", 0, "Strict")]);
}
async function issueTokens(kv, origin, subject, scope) {
  const accessToken = randomToken(), refreshToken = randomToken();
  const base = { subject, clientId: CLIENT, resource: origin + "/mcp", scope };
  await Promise.all([
    kv.put("mcp:access:" + await digest(accessToken), JSON.stringify({ ...base, expiresAt: Date.now() + ACCESS_TTL * 1000 }), { expirationTtl: ACCESS_TTL }),
    kv.put("mcp:refresh:" + await digest(refreshToken), JSON.stringify({ ...base, expiresAt: Date.now() + REFRESH_TTL * 1000 }), { expirationTtl: REFRESH_TTL })
  ]);
  return response({ access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TTL, refresh_token: refreshToken, scope },
    200, { Pragma: "no-cache" });
}
async function oauthToken(req, kv, origin) {
  if (req.method !== "POST") return OAuthError("method_not_allowed", 405);
  const form = await req.formData().catch(() => null);
  if (!form) return OAuthError("invalid_request");
  const grant = String(form.get("grant_type") || "");
  const clientId = String(form.get("client_id") || "");
  if (clientId !== CLIENT || (form.get("resource") || "") !== origin + "/mcp") return OAuthError("invalid_client", 401);
  if (grant === "authorization_code") {
    const code = String(form.get("code") || ""), verifier = String(form.get("code_verifier") || "");
    if (!/^[a-f0-9]{64}$/.test(code) || !/^[A-Za-z0-9._~\-]{43,128}$/.test(verifier)) return OAuthError("invalid_grant");
    const key = "mcp:code:" + await digest(code);
    const rec = await kv.get(key, { type: "json" });
    if (!rec || rec.expiresAt < Date.now() || rec.clientId !== CLIENT ||
        rec.redirectUri !== form.get("redirect_uri") || rec.resource !== origin + "/mcp" ||
        rec.challenge !== await pkce(verifier)) return OAuthError("invalid_grant");
    await kv.delete(key);
    return issueTokens(kv, origin, rec.subject, rec.scope);
  }
  if (grant === "refresh_token") {
    const token = String(form.get("refresh_token") || "");
    if (!/^[a-f0-9]{64}$/.test(token)) return OAuthError("invalid_grant");
    const key = "mcp:refresh:" + await digest(token);
    const rec = await kv.get(key, { type: "json" });
    if (!rec || rec.expiresAt < Date.now() || rec.clientId !== CLIENT ||
        rec.resource !== origin + "/mcp" || !parseScopes(rec.scope)) return OAuthError("invalid_grant");
    await kv.delete(key);
    return issueTokens(kv, origin, rec.subject, rec.scope);
  }
  return OAuthError("unsupported_grant_type");
}
async function oauthAuthorize(req, env, kv, origin, deps) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return html("Draft Lab Google sign-in is required for this connector.", 503);
  if (req.method === "GET") {
    const url = new URL(req.url);
    const params = authorizeParameters(url, origin);
    if (!params) return html("Unsupported OAuth client, redirect, resource, scope or PKCE request.", 400);
    const me = await deps.getUser(req);
    if (!me) {
      const relativeReturn = url.pathname + url.search;
      if (relativeReturn.length > 2500) return html("OAuth request is too long.", 400);
      return html("<!doctype html><meta charset='utf-8'><title>Draft Lab sign-in</title>" +
        "<h2>Sign in to Draft Lab</h2><p>Only the connected Draft Lab owner can authorize read-only Yahoo trade access.</p>" +
        "<p><a href='/auth/google/start'>Sign in with Google</a></p>", 200,
        { "Set-Cookie": setCookie(RETURN_COOKIE, relativeReturn, 600) });
    }
    if (!me.admin || me.accountsOff) return html("Only the signed-in Draft Lab administrator may authorize this connection.", 403);
    const consent = randomToken();
    await kv.put("mcp:consent:" + await digest(consent),
      JSON.stringify({ params, subject: me.id, expiresAt: Date.now() + 600000 }), { expirationTtl: 600 });
    return html("<!doctype html><html><head><meta charset='utf-8'><title>Authorize Draft Lab</title></head><body>" +
      "<h2>Connect AEO Draft Lab to ChatGPT?</h2><p>Signed in as " + escapeHtml(me.email || me.name || "Draft Lab administrator") + ".</p>" +
      "<p>This grants ChatGPT <strong>read-only access to your pending Yahoo fantasy trade offers</strong> in connected Draft Lab leagues.</p>" +
      (params.scope.includes(CONTEXT_SCOPE) ? "<p>This also includes official draft results, league settings, rosters and standings for trade analysis.</p>" : "") +
      "<p>ChatGPT will not receive your Yahoo credentials. Accepting, rejecting, or proposing trades is not supported.</p>" +
      "<form method='post' action='/oauth/authorize'><input type='hidden' name='consent' value='" + consent + "'>" +
      "<button type='submit' name='decision' value='approve'>Authorize read-only access</button> " +
      "<button type='submit' name='decision' value='deny'>Cancel</button></form></body></html>",
      200, { "Set-Cookie": setCookie(CONSENT_COOKIE, consent, 600, "Strict") });
  }
  if (req.method !== "POST") return OAuthError("method_not_allowed", 405);
  const requestOrigin = req.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) return OAuthError("invalid_request", 403);
  const me = await deps.getUser(req);
  if (!me || !me.admin || me.accountsOff) return OAuthError("access_denied", 403);
  const body = await req.formData().catch(() => null);
  const consent = String(body?.get("consent") || "");
  if (!/^[a-f0-9]{64}$/.test(consent) || cookie(req, CONSENT_COOKIE) !== consent) return OAuthError("invalid_request", 403);
  const key = "mcp:consent:" + await digest(consent);
  const rec = await kv.get(key, { type: "json" });
  if (!rec || rec.subject !== me.id || rec.expiresAt < Date.now()) return OAuthError("access_denied", 403);
  await kv.delete(key);
  if (body.get("decision") !== "approve") return responseToClient(rec.params, origin, { error: "access_denied" });
  const code = randomToken();
  await kv.put("mcp:code:" + await digest(code),
    JSON.stringify({ ...rec.params, subject: me.id, expiresAt: Date.now() + AUTH_TTL * 1000 }), { expirationTtl: AUTH_TTL });
  return responseToClient(rec.params, origin, { code });
}
function bearerChallenge(origin, scope = SCOPE, insufficient = false) {
  return 'Bearer resource_metadata="' + origin + '/.well-known/oauth-protected-resource/mcp", scope="' + scope + '"' +
    (insufficient ? ', error="insufficient_scope"' : '');
}

function challenge(origin) {
  return response({ error: "unauthorized" }, 401, { "WWW-Authenticate": bearerChallenge(origin) });
}
async function mcpAccess(req, kv, origin) {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(req.headers.get("authorization") || "");
  if (!match) return null;
  const rec = await kv.get("mcp:access:" + await digest(match[1]), { type: "json" });
  if (!rec || rec.expiresAt < Date.now() || rec.clientId !== CLIENT ||
      rec.resource !== origin + "/mcp" || !parseScopes(rec.scope)) return null;
  const user = await kv.get("user:" + rec.subject, { type: "json" });
  if (!user || !user.admin) return null;
  return rec;
}
const leagueSchema = { type: "string", description: "Draft Lab Yahoo league profile slug, e.g. aeok-auction." };
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const valueMap = {
  type: "object", description: "Numeric values keyed by the Yahoo player key from the live trade.",
  additionalProperties: { type: "number", minimum: 0 }, maxProperties: 100
};
const valueSource = {
  source: { type: "string", maxLength: 100 },
  asOf: { type: "string", description: "ISO date or timestamp when values were observed." },
  values: valueMap
};
function readTool(name, description, properties, required, scopes) {
  return { name, description, inputSchema: { type: "object", properties, required, additionalProperties: false },
    annotations: READ_ONLY, _meta: { securitySchemes: [{ type: "oauth2", scopes }] } };
}
const projectionSchema = { type: "object", properties: valueSource, required: ["source", "asOf", "values"], additionalProperties: false };
const playerKeys = { type: "array", minItems: 1, maxItems: 8, uniqueItems: true,
  items: { type: "string", pattern: "^\\d+\\.p\\.\\d+$" } };
const counterofferSchema = { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false,
  required: ["partnerTeamKey", "giving", "receiving"], properties: {
    partnerTeamKey: { type: "string", pattern: "^\\d+\\.l\\.\\d+\\.t\\.\\d+$" },
    giving: playerKeys, receiving: playerKeys
  } } };
function validCounteroffers(value) {
  const keysValid = keys => Array.isArray(keys) && keys.length >= 1 && keys.length <= 8 &&
    new Set(keys).size === keys.length && keys.every(key => typeof key === "string" && /^\d+\.p\.\d+$/.test(key));
  return Array.isArray(value) && value.length <= 6 && value.every(offer => offer &&
    typeof offer.partnerTeamKey === "string" && /^\d+\.l\.\d+\.t\.\d+$/.test(offer.partnerTeamKey) &&
    keysValid(offer.giving) && keysValid(offer.receiving) &&
    Object.keys(offer).length === 3 && !offer.giving.some(key => offer.receiving.includes(key)));
}
const TOOLS = [
  readTool("list_yahoo_leagues", "List your configured Yahoo Draft Lab league profiles and their slugs.", {}, [], [SCOPE]),
  readTool("get_pending_trades", "Read live incoming and outgoing pending Yahoo trades for your team. Includes player directions and source timestamp.",
    { league: leagueSchema }, ["league"], [SCOPE]),
  readTool("get_yahoo_draft_results", "Read official Yahoo auction draft results, costs and keeper flags. An optional season selects a Yahoo season configured for the league.",
    { league: leagueSchema, season: { type: "integer", minimum: 2000, maximum: 2100 } }, ["league"], SCOPES),
  readTool("get_yahoo_trade_analysis", "Read live pending trades with Yahoo settings, current roster impact, standings, official auction keeper costs and league strategy. Optional hypothetical counteroffers are checked against Yahoo rosters. Optional sourced inputs supply market values and projections.",
    { league: leagueSchema, counteroffers: counterofferSchema, valuations: {
      type: "object", additionalProperties: false, properties: {
        market: { type: "object", additionalProperties: false,
          properties: { ...valueSource, format: { type: "string", maxLength: 100 }, replacementValue: { type: "number", minimum: 0 } },
          required: ["source", "asOf", "values", "format", "replacementValue"] },
        projectedAuction: projectionSchema, projectedRestOfSeason: projectionSchema, projectedPlayoffs: projectionSchema,
        projectedMultiYear: projectionSchema
      }
    } }, ["league"], SCOPES)
];
async function mcpPost(req, deps, access) {
  if (req.method === "GET") return response({ error: "SSE streaming not implemented; use POST" }, 405, { Allow: "POST" });
  if (req.method !== "POST") return response({ error: "method not allowed" }, 405, { Allow: "POST" });
  const rpc = await req.json().catch(() => null);
  if (!rpc || Array.isArray(rpc) || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") return response({
    jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid JSON-RPC request" }
  }, 400);
  if (rpc.id == null) return new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } });
  const send = result => response({ jsonrpc: "2.0", id: rpc.id, result });
  const fail = (code, message) => response({ jsonrpc: "2.0", id: rpc.id, error: { code, message } });
  if (rpc.method === "initialize") {
    const requested = rpc.params?.protocolVersion;
    const protocolVersion = SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0];
    return send({ protocolVersion, capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "aeo-draft-lab", version: "1.1.0" }, instructions: "Read-only Yahoo fantasy trade and league data." });
  }
  if (rpc.method === "ping") return send({});
  if (rpc.method === "tools/list") return send({ tools: TOOLS });
  if (rpc.method !== "tools/call") return fail(-32601, "Method not found");
  const toolName = rpc.params?.name;
  const tool = TOOLS.find(entry => entry.name === toolName);
  if (!tool) return fail(-32602, "Unknown tool");
  const scopes = tool._meta.securitySchemes[0].scopes;
  if (!scopes.every(scope => access.scope.split(" ").includes(scope))) {
    const challenge = bearerChallenge(new URL(req.url).origin, scopes.join(" "), true);
    return send({ isError: true, content: [{ type: "text", text: "Authorize the additional read-only trade context scope." }],
      _meta: { "mcp/www_authenticate": [challenge] } });
  }
  const args = rpc.params?.arguments ?? {};
  if (!args || typeof args !== "object" || Array.isArray(args) ||
      Object.keys(args).some(key => !Object.hasOwn(tool.inputSchema.properties, key))) {
    return fail(-32602, "Invalid tool arguments");
  }
  if (toolName !== "list_yahoo_leagues" && (typeof args.league !== "string" || !/^[a-z0-9-]{1,40}$/.test(args.league))) {
    return fail(-32602, "A valid league slug is required");
  }
  if (args.season !== undefined && (!Number.isInteger(args.season) || args.season < 2000 || args.season > 2100)) {
    return fail(-32602, "A valid draft season is required");
  }
  if (args.counteroffers !== undefined && !validCounteroffers(args.counteroffers)) {
    return fail(-32602, "Invalid hypothetical counteroffers");
  }
  try {
    const { subject } = access;
    const readers = {
      list_yahoo_leagues: () => deps.listLeagues(subject),
      get_pending_trades: () => deps.getTrades(args.league, subject),
      get_yahoo_draft_results: () => deps.getDraft(args.league, args.season, subject),
      get_yahoo_trade_analysis: () => deps.analyzeTrades(args.league, { valuations: args.valuations, counteroffers: args.counteroffers }, subject)
    };
    const data = await readers[toolName]();
    return send({ content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data });
  } catch (err) {
    // Provider response bodies and OAuth errors can include private details.
    const message = String(err?.message || "");
    const safe = /^Yahoo (?:API|token endpoint returned) (\d{3})\b/.exec(message);
    const detail = safe ? ` (Yahoo HTTP ${safe[1]})` :
      /^(?:Yahoo account is not connected|The Yahoo connection is not linked|Draft Lab league profile not found|Could not identify exactly one Yahoo team|No Yahoo league is configured|Yahoo returned a different season|Yahoo reports a non-auction|Yahoo did not return a pending-trades collection|Yahoo returned incomplete pending-trade data)/.test(message)
        ? ": " + message : "";
    return send({ content: [{ type: "text", text: "Could not retrieve live Yahoo data" + detail }], isError: true });
  }
}

export function readMcpReturn(req) {
  const target = cookie(req, RETURN_COOKIE);
  return target.startsWith("/oauth/authorize?") && target.length < 2501 ? target : "/";
}
export function clearMcpReturnCookie() { return setCookie(RETURN_COOKIE, "", 0); }
export async function handleDraftLabMcp(req, env, url, deps) {
  const origin = env.MCP_PUBLIC_ORIGIN || "https://aeo-draft-lab.hkeseyan.workers.dev";
  if (url.origin !== origin) return response({ error: "invalid origin" }, 400);
  const path = url.pathname, kv = env.MOCKS;
  if (path === "/.well-known/oauth-protected-resource" || path === "/.well-known/oauth-protected-resource/mcp") {
    return response({ resource: origin + "/mcp", authorization_servers: [origin], scopes_supported: SCOPES });
  }
  if (path === "/.well-known/oauth-authorization-server") {
    return response({ issuer: origin, authorization_endpoint: origin + "/oauth/authorize",
      token_endpoint: origin + "/oauth/token", response_types_supported: ["code"],
      grant_types_supported: ["authorization_code","refresh_token"], scopes_supported: SCOPES,
      code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["none"],
      client_id_metadata_document_supported: true, authorization_response_iss_parameter_supported: true });
  }
  if (!kv) return response({ error: "KV unavailable" }, 503);
  if (path === "/oauth/authorize") return oauthAuthorize(req, env, kv, origin, deps);
  if (path === "/oauth/token") return oauthToken(req, kv, origin);
  if (path === "/mcp") {
    const access = await mcpAccess(req, kv, origin);
    if (!access) return challenge(origin);
    return mcpPost(req, deps, access);
  }
  return response({ error: "not found" }, 404);
}

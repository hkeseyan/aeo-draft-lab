import assert from "node:assert/strict";
import { handleDraftLabMcp, readMcpReturn } from "../draft-lab-mcp.js";

const origin = "https://aeo-draft-lab.hkeseyan.workers.dev";
class MemoryKv {
  constructor() { this.records = new Map([["user:owner-id", JSON.stringify({ id: "owner-id", admin: true })]]); }
  async get(key, options) {
    const raw = this.records.get(key);
    return raw == null ? null : options?.type === "json" ? JSON.parse(raw) : raw;
  }
  async put(key, value) { this.records.set(key, String(value)); }
  async delete(key) { this.records.delete(key); }
}
const kv = new MemoryKv();
const env = { MOCKS: kv, GOOGLE_CLIENT_ID: "test-google-client", GOOGLE_CLIENT_SECRET: "test-google-secret",
  MCP_PUBLIC_ORIGIN: origin };
const calls = [];
const deps = {
  getUser: async req => req.headers.get("x-test-user") === "no" ? null :
    req.headers.get("x-test-user") === "ordinary" ? { id: "other", admin: false } :
    { id: "owner-id", email: "owner@example.test", admin: true },
  listLeagues: async () => ({ leagues: [{ league: "aeok-auction", name: "AEOK Auction League" }] }),
  getTrades: async league => { calls.push(league); return {
    source: "Yahoo Fantasy Sports API", verifiedLiveYahoo: true, leagueKey: "449.l.868349",
    team: { name: "Pennybags" }, count: 1, offers: [{ giving: ["X"], receiving: ["Y"] }]
  }; }
};
const invoke = async (path, init = {}, override = deps, e = env) =>
  handleDraftLabMcp(new Request(origin + path, init), e, new URL(origin + path), override);

let res = await invoke("/.well-known/oauth-protected-resource/mcp");
assert.equal(res.status, 200);
assert.equal((await res.json()).resource, origin + "/mcp");
res = await invoke("/.well-known/oauth-authorization-server");
const meta = await res.json();
assert.equal(meta.issuer, origin);
assert.deepEqual(meta.code_challenge_methods_supported, ["S256"]);
assert.equal(meta.client_id_metadata_document_supported, true);
assert.ok(meta.authorization_response_iss_parameter_supported);
res = await invoke("/mcp", { method: "POST", body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' });
assert.equal(res.status, 401);
assert.ok(res.headers.get("www-authenticate").includes("oauth-protected-resource"));

const verifier = "v".repeat(64);
const digested = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
const challenge = btoa(String.fromCharCode(...new Uint8Array(digested)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const params = new URLSearchParams({
  client_id: "https://chatgpt.com/oauth/client.json",
  redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
  response_type: "code", code_challenge: challenge, code_challenge_method: "S256",
  resource: origin + "/mcp", scope: "trades:read", state: "client-state-123"
});
const authPath = "/oauth/authorize?" + params;
res = await invoke(authPath, { headers: { "x-test-user": "no" } });
assert.equal(res.status, 200);
assert.ok((await res.text()).includes("Sign in with Google"));
assert.equal(readMcpReturn(new Request(origin, { headers: { cookie: res.headers.get("set-cookie") } })), authPath);
res = await invoke(authPath, { headers: { "x-test-user": "ordinary" } });
assert.equal(res.status, 403);
res = await invoke(authPath);
assert.equal(res.status, 200);
const cookie = res.headers.get("set-cookie").split(";")[0];
const formHtml = await res.text();
const consent = /name='consent' value='([a-f0-9]+)'/.exec(formHtml)?.[1];
assert.ok(consent);
res = await invoke("/oauth/authorize", { method: "POST",
  headers: { cookie, "Content-Type": "application/x-www-form-urlencoded", Origin: origin },
  body: new URLSearchParams({ consent, decision: "approve" })
});
assert.equal(res.status, 302);
const cb = new URL(res.headers.get("location"));
assert.equal(cb.origin, "https://chatgpt.com");
assert.equal(cb.searchParams.get("iss"), origin);
assert.equal(cb.searchParams.get("state"), "client-state-123");
const code = cb.searchParams.get("code");
assert.ok(code);
const tokenForm = new URLSearchParams({
  grant_type: "authorization_code", client_id: params.get("client_id"),
  redirect_uri: params.get("redirect_uri"), code, resource: origin + "/mcp", code_verifier: "z".repeat(64)
});
res = await invoke("/oauth/token", { method: "POST", body: tokenForm });
assert.equal(res.status, 400, "invalid PKCE must fail");
tokenForm.set("code_verifier", verifier);
res = await invoke("/oauth/token", { method: "POST", body: tokenForm });
assert.equal(res.status, 200);
const token = await res.json();
assert.equal(token.token_type, "Bearer");
assert.ok(token.access_token.length >= 64);
assert.ok(!JSON.stringify([...kv.records]).includes(token.access_token), "never persist raw OAuth access token");
res = await invoke("/oauth/token", { method: "POST", body: tokenForm });
assert.equal(res.status, 400, "authorization code must be consumed");

const rpc = (method, params = {}, id = 1) => new Request(origin + "/mcp", {
  method: "POST", headers: { Authorization: "Bearer " + token.access_token, "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", method, params, id })
});
res = await handleDraftLabMcp(rpc("initialize"), env, new URL(origin + "/mcp"), deps);
assert.equal(res.status, 200);
assert.ok((await res.json()).result.capabilities.tools);
res = await handleDraftLabMcp(rpc("tools/list"), env, new URL(origin + "/mcp"), deps);
const listed = (await res.json()).result.tools;
assert.deepEqual(listed.map(x => x.name), ["list_yahoo_leagues", "get_pending_trades"]);
assert.ok(listed.every(x => x.annotations?.readOnlyHint === true));
res = await handleDraftLabMcp(rpc("tools/call", { name: "get_pending_trades", arguments: { league: "aeok-auction" } }),
  env, new URL(origin + "/mcp"), deps);
const trade = (await res.json()).result.structuredContent;
assert.equal(trade.team.name, "Pennybags");
assert.deepEqual(calls, ["aeok-auction"]);
res = await handleDraftLabMcp(rpc("tools/call", { name: "accept_trade", arguments: {} }),
  env, new URL(origin + "/mcp"), deps);
assert.equal((await res.json()).error.code, -32602, "no transaction writes");

const refresh = new URLSearchParams({ grant_type: "refresh_token", client_id: params.get("client_id"),
  resource: origin + "/mcp", refresh_token: token.refresh_token });
res = await invoke("/oauth/token", { method: "POST", body: refresh });
assert.equal(res.status, 200);
res = await invoke("/oauth/token", { method: "POST", body: refresh });
assert.equal(res.status, 400, "refresh token rotates");
const noGoogle = { ...env, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" };
res = await invoke(authPath, {}, deps, noGoogle);
assert.equal(res.status, 503, "MCP authorizations require Google sign-in");
const wrongClient = new URLSearchParams(params);
wrongClient.set("client_id", "https://untrusted.example/client.json");
res = await invoke("/oauth/authorize?" + wrongClient);
assert.equal(res.status, 400);
res = await handleDraftLabMcp(new Request("https://wrong.example/mcp"), env, new URL("https://wrong.example/mcp"), deps);
assert.equal(res.status, 400);
console.log("Draft Lab MCP OAuth, PKCE, read-only tool and security tests passed.");

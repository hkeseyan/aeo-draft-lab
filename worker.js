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
var worker_default = {
  async fetch(request, env) {
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
          const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
          const mockList = await kv.list({ prefix: `mock:${id}:` });
          await Promise.all(mockList.keys.map((k) => kv.delete(k.name)));
          return J({ ok: true });
        }
        return J({ error: "method" }, 405);
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
            mflGet("players").then((pd) => {
              const list = pd && pd.players && pd.players.player || [];
              const fresh = {};
              list.forEach((p) => {
                fresh[p.id] = p;
              });
              return Promise.all([
                kv.put(playersCacheKey, JSON.stringify(fresh)),
                kv.put(`${playersCacheKey}:ts`, String(Date.now()))
              ]);
            });
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
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map

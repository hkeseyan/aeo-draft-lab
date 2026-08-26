// Cloudflare Worker for AEO Draft Lab — authoritative server-side entry point.
// Serves the static SPA (public/index.html via the ASSETS binding) and a
// KV-backed API for cross-device setup persistence (keepers, trades, in-progress
// picks), versioned backups, league profiles, mock draft history, and best-effort
// Sleeper/MFL league imports. functions/api/* is legacy Cloudflare Pages Functions
// code, unused now that the app deploys as a Worker — don't resurrect it.
//
// API:
//   GET/PUT /api/setup             -> current league setup (keepers/trades/picks)
//   GET     /api/setup/history     -> rolling backup snapshots (last 30)
//   POST    /api/setup/restore     -> roll back to a snapshot {ts}
//   GET/PUT /api/commish           -> commissioner-mode membership (returning/dues/contact)
//   GET     /api/commish/history   -> rolling backup snapshots (last 30)
//   POST    /api/commish/restore   -> roll back to a snapshot {ts}
//   GET/POST /api/leagues          -> list / create league profiles
//   PUT/DELETE /api/leagues/:id    -> update / delete a league profile
//   GET     /api/leagues/:id/history  -> rolling backup snapshots of that profile
//   POST    /api/leagues/:id/restore  -> roll back a league profile to a snapshot {ts}
//   GET     /api/import/sleeper/:sleeperLeagueId -> best-effort structure import
//   GET     /api/import/mfl/:mflLeagueId          -> best-effort structure import (?year=)
//   GET     /api/import/yahoo/:leagueKey          -> best-effort structure import
//                                     (public leagues need only the app's
//                                     YAHOO_CLIENT_ID/SECRET — 2-legged OAuth1,
//                                     no user sign-in; uses the stored user
//                                     token instead when one exists)
//   GET/POST /api/mocks            -> list / save mock drafts
//   GET/DELETE /api/mocks/:id      -> load / delete a mock
//   GET     /api/auth/state        -> {enabled, user} — is auth on, who am I
//   POST    /api/auth/bootstrap    -> claim the very first (admin) account;
//                                     requires the BOOTSTRAP_SECRET env var
//   POST    /api/auth/login|logout -> session cookie in / out
//   POST    /api/auth/password     -> change your own password
//   GET/POST /api/auth/users       -> admin: list / create-or-reset an account
//   DELETE  /api/auth/users/:name  -> admin: delete an account + its private data
//   GET/PUT /api/private           -> per-user, per-league draft state (queue,
//                                     tendencies, in-progress picks)
//   GET/PUT /api/rankings          -> per-user, per-league custom rankings
//   GET     /api/rankings/history  -> rolling backup snapshots (last 20)
//   POST    /api/rankings/restore  -> roll back rankings to a snapshot {ts}
//   GET     /api/yahoo/status      -> is a Yahoo account connected?
//   GET     /api/yahoo/leagues     -> diagnostic: list the connected account's
//                                     NFL leagues (raw Yahoo JSON + best-effort
//                                     parse; roster import isn't built yet)
//   GET     /auth/yahoo/start      -> redirect to Yahoo's OAuth consent screen
//   GET     /auth/yahoo/callback   -> OAuth code exchange, stores the token in KV
//
// All /api/* routes accept a ?league= query param to scope KV keys per league
// profile; aeo-keepers keeps its original unprefixed keys (setup:main, index,
// mock:<id>) so its pre-existing saved data needed zero migration when
// multi-league support was added. Requires a KV namespace bound as MOCKS (see
// wrangler.toml). Optional AUTH_TOKEN env var requires a matching x-auth-token
// header on all /api/* routes (not /auth/yahoo/*, which Yahoo's redirect hits
// directly and can't attach custom headers to) — that's the blunt whole-API
// gate, unrelated to the per-user accounts below. Accounts are optional: with
// none created, every route behaves exactly as it did before they existed. Yahoo OAuth needs YAHOO_CLIENT_ID
// and YAHOO_CLIENT_SECRET secrets (npx wrangler secret put ...) — not set in
// wrangler.toml, never committed.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,x-auth-token",
};
const J = (obj, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extraHeaders },
  });

function authed(request, env) {
  if (!env.AUTH_TOKEN) return true;
  return request.headers.get("x-auth-token") === env.AUTH_TOKEN;
}

// League-scoped KV keys. AEO-Keepers keeps its original, unprefixed keys so
// existing saved data (mocks, setup) keeps working with zero migration; any
// other league id gets its own namespaced keys.
function leagueId(url) {
  const l = url.searchParams.get("league");
  return l && /^[a-z0-9-]{1,40}$/.test(l) ? l : "aeo-keepers";
}
const setupKey = (lg) => (lg === "aeo-keepers" ? "setup:main" : `setup:${lg}`);
const historyKey = (lg) => `history:${lg}`;
const mocksIndexKey = (lg) => (lg === "aeo-keepers" ? "index" : `index:${lg}`);
const mockRecordKey = (lg, id) => (lg === "aeo-keepers" ? `mock:${id}` : `mock:${lg}:${id}`);
const leagueProfileKey = (id) => `league:${id}`;
const leagueHistoryKey = (id) => `leagueHistory:${id}`;
const commishKey = (lg) => `commish:${lg}`;
const commishHistoryKey = (lg) => `commishHistory:${lg}`;

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 40) || "league";
}

// ---- Accounts & sessions -------------------------------------------------
// Real per-user auth, added so the league can be shared with friends without
// handing them the owner's rankings, queue and draft state. Deliberately small:
// PBKDF2-hashed passwords and opaque session tokens in KV — no email, no reset
// emails (an admin resets a password from the Account tab).
//
// Auth is OPTIONAL. With zero accounts in KV the API behaves exactly as it did
// before this existed, so the guest link and any device that hasn't signed in
// keep working. The moment the first account is created, writes start requiring
// an admin session and private data starts requiring any session.
const userKey = (name) => `user:${String(name).toLowerCase()}`;
const sessionKey = (tok) => `session:${tok}`;
const AUTH_ENABLED_KEY = "auth:enabled";
const SESSION_COOKIE = "aeo_sess";
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
const PBKDF2_ITERATIONS = 100000;
const USERNAME_RE = /^[A-Za-z0-9_.-]{2,32}$/;

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

async function hashPassword(password, saltB64, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: unb64(saltB64), iterations, hash: "SHA-256" },
    key,
    256
  );
  return b64(bits);
}

// Compares two secrets of any length without leaking how far they matched:
// hashing first makes the compared values fixed-length, so length alone tells
// an attacker nothing either.
async function secretsMatch(a, b) {
  const digest = async (v) => b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  return digestsEqual(await digest(a), await digest(b));
}

// Compares two base64 digests without leaking how far they matched.
function digestsEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const randomB64 = (n) => b64(crypto.getRandomValues(new Uint8Array(n)));
const randomToken = () => randomB64(32).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c]));

function cookieValue(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
const setSessionCookie = (tok, maxAge) => ({
  "Set-Cookie": `${SESSION_COOKIE}=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
});

async function currentUser(request, kv) {
  const tok = cookieValue(request, SESSION_COOKIE);
  if (!tok) return null;
  const sess = await kv.get(sessionKey(tok), { type: "json" });
  if (!sess) return null;
  const u = await kv.get(userKey(sess.u), { type: "json" });
  if (!u) return null;
  return { name: u.name, role: u.role, token: tok };
}
const publicUser = (u) => (u ? { name: u.name, role: u.role } : null);

async function createUser(kv, name, password, role) {
  const salt = randomB64(16);
  const rec = {
    name,
    role,
    salt,
    hash: await hashPassword(password, salt),
    iterations: PBKDF2_ITERATIONS,
    created: Date.now(),
  };
  await kv.put(userKey(name), JSON.stringify(rec));
  await kv.put(AUTH_ENABLED_KEY, "1");
  return rec;
}

// Session tokens are opaque and only resolvable through KV, so revoking is a
// delete. The session list is tiny (one household of friends), so scanning it
// to drop every session belonging to a user is cheap enough.
async function dropSessionsFor(kv, username, exceptToken) {
  const list = await kv.list({ prefix: "session:" });
  await Promise.all(
    list.keys.map(async (k) => {
      if (exceptToken && k.name === sessionKey(exceptToken)) return;
      const sess = await kv.get(k.name, { type: "json" });
      if (sess && String(sess.u).toLowerCase() === String(username).toLowerCase()) await kv.delete(k.name);
    })
  );
}

// Per-user, per-league keys. Draft state churns (every pick autosaves) so it is
// kept apart from rankings, which are hand-built, rarely written, and worth a
// backup history of their own.
const privateKey = (user, lg) => `private:${String(user).toLowerCase()}:${lg}`;
const rankingsKey = (user, lg) => `rankings:${String(user).toLowerCase()}:${lg}`;
const rankingsHistoryKey = (user, lg) => `rankingsHistory:${String(user).toLowerCase()}:${lg}`;

// ---- Yahoo OAuth (single connected account — this is a personal tool, not
// multi-tenant, so one stored grant covers whichever Yahoo leagues you import) ----
const YAHOO_AUTH_KEY = "yahooAuth:default";
const yahooRedirectUri = (url) => `${url.origin}/auth/yahoo/callback`;

async function yahooTokenRequest(env, params) {
  const basic = btoa(`${env.YAHOO_CLIENT_ID}:${env.YAHOO_CLIENT_SECRET}`);
  const r = await fetch("https://api.login.yahoo.com/oauth2/get_token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!r.ok) throw new Error("Yahoo token endpoint returned " + r.status + ": " + (await r.text()).slice(0, 300));
  return r.json();
}

// Returns a valid access token, refreshing it first if it's expired (or close to
// it). Returns null if no Yahoo account has ever been connected.
async function getYahooAccessToken(env, kv, url) {
  const auth = await kv.get(YAHOO_AUTH_KEY, { type: "json" });
  if (!auth) return null;
  if (Date.now() < auth.expires_at - 60000) return auth.access_token;
  const tok = await yahooTokenRequest(env, {
    grant_type: "refresh_token",
    redirect_uri: yahooRedirectUri(url),
    refresh_token: auth.refresh_token,
  });
  const updated = {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || auth.refresh_token,
    expires_at: Date.now() + tok.expires_in * 1000,
  };
  await kv.put(YAHOO_AUTH_KEY, JSON.stringify(updated));
  return updated.access_token;
}

// ---- Yahoo public-league access (2-legged OAuth 1.0a) --------------------
// Yahoo's Fantasy API refuses every unauthenticated request with
// oauth_problem="unable_to_determine_oauth_type", but a *public* league does
// not need a signed-in user — only an app signature. That's 2-legged OAuth 1.0a:
// the request carries oauth_consumer_key and an HMAC-SHA1 signature made with
// the consumer secret alone, no oauth_token and no consent screen. So public
// leagues are readable with just YAHOO_CLIENT_ID/YAHOO_CLIENT_SECRET, without
// waiting on Yahoo to approve user-level Fantasy API access.
//
// When a user HAS connected their Yahoo account (see /auth/yahoo/*), the stored
// bearer token is used instead — same routes, but private leagues work too.
const pct = (s) =>
  encodeURIComponent(String(s)).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

async function hmacSha1B64(key, message) {
  const k = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
  );
  return b64(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message)));
}

// Builds the fully-signed GET url. Params go in the query string (not an
// Authorization header) — both are legal, and it keeps the fetch call trivial.
async function yahooOauth1Url(env, baseUrl) {
  const params = {
    format: "json",
    oauth_consumer_key: env.YAHOO_CLIENT_ID,
    oauth_nonce: randomB64(12).replace(/[^A-Za-z0-9]/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
  };
  const normalized = Object.keys(params).sort().map((k) => `${pct(k)}=${pct(params[k])}`).join("&");
  const base = `GET&${pct(baseUrl)}&${pct(normalized)}`;
  // 2-legged: the token secret half of the signing key is empty, but the "&" stays.
  const signature = await hmacSha1B64(`${pct(env.YAHOO_CLIENT_SECRET)}&`, base);
  return `${baseUrl}?${normalized}&oauth_signature=${pct(signature)}`;
}

// One GET against the Fantasy API, bearer-token first and app-signature second.
async function yahooApiGet(env, kv, url, endpointPath) {
  const baseUrl = `https://fantasysports.yahooapis.com/fantasy/v2${endpointPath}`;
  let token = null;
  try { token = await getYahooAccessToken(env, kv, url); } catch { token = null; }
  const r = token
    ? await fetch(`${baseUrl}?format=json`, { headers: { Authorization: `Bearer ${token}` } })
    : await fetch(await yahooOauth1Url(env, baseUrl));
  const text = await r.text();
  if (!r.ok) {
    const hint = /oauth/i.test(text) ? " (Yahoo rejected the app signature — check YAHOO_CLIENT_ID/SECRET, and that the league is public)" : "";
    throw new Error(`Yahoo returned ${r.status} for ${endpointPath}${hint}: ${text.slice(0, 300)}`);
  }
  try { return JSON.parse(text); } catch { throw new Error(`Yahoo returned non-JSON for ${endpointPath}: ${text.slice(0, 200)}`); }
}

// Yahoo's JSON is XML wearing a JSON hat: collections are objects keyed
// "0","1",... alongside a `count`, and one entity is an array of small fragment
// objects (sometimes nested a level deeper). These two put it back into
// ordinary JS so the mapping below reads like the Sleeper/MFL importers.
function yList(obj) {
  if (!obj || typeof obj !== "object") return [];
  // Only the numeric keys are collection entries. A roster node, for instance,
  // sits alongside coverage_type/date/is_editable siblings that are metadata,
  // and `count` is never an entry either.
  return Object.keys(obj)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => obj[k])
    .filter(Boolean);
}
function yFlat(node, out) {
  out = out || {};
  if (Array.isArray(node)) node.forEach((n) => yFlat(n, out));
  else if (node && typeof node === "object") Object.assign(out, node);
  return out;
}

// Yahoo roster slot names -> ours. BN/IR aren't starters, so they're dropped.
const YAHOO_SLOT_MAP = {
  QB: "QB", RB: "RB", WR: "WR", TE: "TE", K: "K", DEF: "DST",
  "W/R": "FLEX", "W/T": "FLEX", "R/W": "FLEX", "W/R/T": "FLEX", "R/W/T": "FLEX",
  "Q/W/R/T": "SUPERFLEX", "QB/W/R/T": "SUPERFLEX",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---- /auth/yahoo/* : OAuth handshake, outside /api/ (Yahoo's redirect can't
    // carry our x-auth-token header, so this must not be gated by authed()) ----
    if (path === "/auth/yahoo/start") {
      if (!env.YAHOO_CLIENT_ID) return new Response("Yahoo OAuth isn't configured (missing YAHOO_CLIENT_ID secret).", { status: 500 });
      const authUrl = "https://api.login.yahoo.com/oauth2/request_auth?" + new URLSearchParams({
        client_id: env.YAHOO_CLIENT_ID,
        redirect_uri: yahooRedirectUri(url),
        response_type: "code",
        language: "en-us",
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
          code,
        });
        await env.MOCKS.put(YAHOO_AUTH_KEY, JSON.stringify({
          access_token: tok.access_token,
          refresh_token: tok.refresh_token,
          expires_at: Date.now() + tok.expires_in * 1000,
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

      // ---- Accounts: /api/auth/* ------------------------------------------
      // Resolved up front because everything below is gated on it. The user
      // lookup only runs when a session cookie is actually present, so the
      // un-signed-in case (guest link, first run) costs one extra KV read.
      const me = cookieValue(request, SESSION_COOKIE) ? await currentUser(request, kv) : null;
      const authEnabled = (await kv.get(AUTH_ENABLED_KEY)) === "1";
      const body = async () => {
        try { return await request.json(); } catch { return null; }
      };

      if (path === "/api/auth/state") {
        // bootstrapReady only matters (and is only reported) before the first
        // account exists, so the setup screen can say whether it can proceed.
        return J({
          enabled: authEnabled,
          user: publicUser(me),
          ...(authEnabled ? {} : { bootstrapReady: !!env.BOOTSTRAP_SECRET }),
        });
      }

      // First account ever: it becomes the admin. Refused once any account
      // exists, so this can't mint a second admin.
      //
      // Claiming it requires the BOOTSTRAP_SECRET, because "first to POST wins"
      // is not proof of anything: this Worker is public, its URL is deliberately
      // shared (the ?guest=1 link), and admin carries write access to every
      // league plus read access to the commissioner's contact and dues data.
      // Without this, whoever found the URL first — not the owner — could claim
      // it and lock the owner out permanently. Fails closed: no secret set, no
      // bootstrap.
      if (path === "/api/auth/bootstrap") {
        if (request.method !== "POST") return J({ error: "method" }, 405);
        if (authEnabled) return J({ error: "an account already exists — sign in instead" }, 409);
        if (!env.BOOTSTRAP_SECRET) {
          return J({
            error: "Account setup is locked. Set a one-time setup key on the Worker first: npx wrangler secret put BOOTSTRAP_SECRET — then enter that key here to claim the admin account.",
          }, 403);
        }
        const b = await body();
        if (!b) return J({ error: "bad json" }, 400);
        if (!(await secretsMatch(String(b.bootstrapSecret || ""), env.BOOTSTRAP_SECRET))) {
          return J({ error: "wrong setup key" }, 403);
        }
        const name = String(b.username || "").trim();
        if (!USERNAME_RE.test(name)) return J({ error: "username must be 2-32 chars: letters, numbers, . _ -" }, 400);
        if (String(b.password || "").length < 4) return J({ error: "password must be at least 4 characters" }, 400);
        await createUser(kv, name, String(b.password), "admin");
        const tok = randomToken();
        await kv.put(sessionKey(tok), JSON.stringify({ u: name, created: Date.now() }), { expirationTtl: SESSION_TTL });
        return J({ ok: true, user: { name, role: "admin" } }, 200, setSessionCookie(tok, SESSION_TTL));
      }

      if (path === "/api/auth/login") {
        if (request.method !== "POST") return J({ error: "method" }, 405);
        const b = await body();
        if (!b) return J({ error: "bad json" }, 400);
        const rec = await kv.get(userKey(String(b.username || "")), { type: "json" });
        // Same response either way — a wrong username and a wrong password are
        // not worth distinguishing for an attacker.
        const bad = J({ error: "wrong username or password" }, 401);
        if (!rec) return bad;
        const hash = await hashPassword(String(b.password || ""), rec.salt, rec.iterations || PBKDF2_ITERATIONS);
        if (!digestsEqual(hash, rec.hash)) return bad;
        const tok = randomToken();
        await kv.put(sessionKey(tok), JSON.stringify({ u: rec.name, created: Date.now() }), { expirationTtl: SESSION_TTL });
        return J({ ok: true, user: { name: rec.name, role: rec.role } }, 200, setSessionCookie(tok, SESSION_TTL));
      }

      if (path === "/api/auth/logout") {
        if (request.method !== "POST") return J({ error: "method" }, 405);
        if (me) await kv.delete(sessionKey(me.token));
        return J({ ok: true }, 200, setSessionCookie("", 0));
      }

      if (path === "/api/auth/password") {
        if (request.method !== "POST") return J({ error: "method" }, 405);
        if (!me) return J({ error: "sign in required" }, 401);
        const b = await body();
        if (!b) return J({ error: "bad json" }, 400);
        if (String(b.next || "").length < 4) return J({ error: "new password must be at least 4 characters" }, 400);
        const rec = await kv.get(userKey(me.name), { type: "json" });
        const hash = await hashPassword(String(b.current || ""), rec.salt, rec.iterations || PBKDF2_ITERATIONS);
        if (!digestsEqual(hash, rec.hash)) return J({ error: "current password is wrong" }, 401);
        const salt = randomB64(16);
        await kv.put(userKey(me.name), JSON.stringify({
          ...rec, salt, hash: await hashPassword(String(b.next), salt), iterations: PBKDF2_ITERATIONS,
        }));
        await dropSessionsFor(kv, me.name, me.token); // other devices have to sign in again
        return J({ ok: true });
      }

      // Admin-only account management: list, create/reset, delete.
      if (path === "/api/auth/users" || path.startsWith("/api/auth/users/")) {
        if (!me) return J({ error: "sign in required" }, 401);
        if (me.role !== "admin") return J({ error: "admin only" }, 403);
        if (path === "/api/auth/users" && request.method === "GET") {
          const list = await kv.list({ prefix: "user:" });
          const users = await Promise.all(list.keys.map((k) => kv.get(k.name, { type: "json" })));
          return J(users.filter(Boolean).map((u) => ({ name: u.name, role: u.role, created: u.created })));
        }
        if (path === "/api/auth/users" && request.method === "POST") {
          const b = await body();
          if (!b) return J({ error: "bad json" }, 400);
          const name = String(b.username || "").trim();
          if (!USERNAME_RE.test(name)) return J({ error: "username must be 2-32 chars: letters, numbers, . _ -" }, 400);
          if (String(b.password || "").length < 4) return J({ error: "password must be at least 4 characters" }, 400);
          const role = b.role === "admin" ? "admin" : "member";
          const existing = await kv.get(userKey(name), { type: "json" });
          if (existing && !b.reset) return J({ error: "that username already exists" }, 409);
          await createUser(kv, existing ? existing.name : name, String(b.password), role);
          if (existing) await dropSessionsFor(kv, existing.name); // a reset kicks them out everywhere
          return J({ ok: true, user: { name: existing ? existing.name : name, role } });
        }
        if (path.startsWith("/api/auth/users/") && request.method === "DELETE") {
          const name = decodeURIComponent(path.split("/").pop());
          if (String(name).toLowerCase() === String(me.name).toLowerCase())
            return J({ error: "you can't delete the account you're signed in as" }, 400);
          const rec = await kv.get(userKey(name), { type: "json" });
          if (!rec) return J({ error: "not found" }, 404);
          await kv.delete(userKey(name));
          await dropSessionsFor(kv, name);
          // Their private data goes with them — nobody else can read it anyway.
          for (const prefix of [`private:${String(name).toLowerCase()}:`, `rankings:${String(name).toLowerCase()}:`, `rankingsHistory:${String(name).toLowerCase()}:`]) {
            const owned = await kv.list({ prefix });
            await Promise.all(owned.keys.map((k) => kv.delete(k.name)));
          }
          return J({ ok: true });
        }
        return J({ error: "method" }, 405);
      }

      // ---- Access control --------------------------------------------------
      // Reads of shared league data stay open (the guest link depends on it and
      // keepers/trades are league facts everyone can see anyway). Once accounts
      // exist: mutations need an admin, per-user data needs any session, and
      // mocks — which a friend running their own board legitimately wants to
      // save — need any session too.
      const isPrivatePath = path === "/api/private" || path.startsWith("/api/rankings");
      const isMockPath = path.startsWith("/api/mocks");
      if (authEnabled) {
        const mutating = request.method !== "GET";
        if (isPrivatePath || (mutating && isMockPath)) {
          if (!me) return J({ error: "sign in required" }, 401);
        } else if (mutating || path.startsWith("/api/commish") || path === "/api/yahoo/leagues" || path.startsWith("/api/import/")) {
          // Commissioner data (dues, contact details) is admin-only to read, not
          // just to write — unlike keepers/trades it isn't a fact of the draft.
          if (!me) return J({ error: "sign in required" }, 401);
          if (me.role !== "admin") return J({ error: "admin only — ask the league's commissioner" }, 403);
        }
      } else if (isPrivatePath) {
        return J({ error: "no accounts exist yet — create one on the Account tab first" }, 400);
      }

      // ---- /api/private : per-user, per-league draft state ------------------
      // Queue, opponent-model tendencies and the in-progress draft live here
      // rather than in /api/setup so that sharing a league doesn't share the
      // owner's strategy — and so two people can run their own boards at once.
      // /api/setup keeps what is a league *fact* (keepers, trades) and stays
      // readable by everyone.
      if (path === "/api/private") {
        const k = privateKey(me.name, lg);
        if (request.method === "GET") return J((await kv.get(k, { type: "json" })) || {});
        if (request.method === "PUT") {
          const b = await body();
          if (!b) return J({ error: "bad json" }, 400);
          await kv.put(k, JSON.stringify(b));
          return J({ ok: true });
        }
        return J({ error: "method" }, 405);
      }

      // ---- /api/rankings : per-user custom player rankings ------------------
      // Kept out of /api/private because these are hand-built over time and
      // written rarely, so they get the same rolling-backup treatment as the
      // other things that would hurt to lose.
      if (path === "/api/rankings") {
        const k = rankingsKey(me.name, lg);
        if (request.method === "GET") return J((await kv.get(k, { type: "json" })) || {});
        if (request.method === "PUT") {
          const b = await body();
          if (!b) return J({ error: "bad json" }, 400);
          const prev = await kv.get(k, { type: "json" });
          if (prev && prev.order && prev.order.length) {
            const hist = (await kv.get(rankingsHistoryKey(me.name, lg), { type: "json" })) || [];
            hist.unshift({ ts: Date.now(), data: prev });
            await kv.put(rankingsHistoryKey(me.name, lg), JSON.stringify(hist.slice(0, 20)));
          }
          await kv.put(k, JSON.stringify(b));
          return J({ ok: true });
        }
        return J({ error: "method" }, 405);
      }
      if (path === "/api/rankings/history") {
        if (request.method !== "GET") return J({ error: "method" }, 405);
        return J((await kv.get(rankingsHistoryKey(me.name, lg), { type: "json" })) || []);
      }
      if (path === "/api/rankings/restore") {
        if (request.method !== "POST") return J({ error: "method" }, 405);
        const b = await body();
        if (!b) return J({ error: "bad json" }, 400);
        const hist = (await kv.get(rankingsHistoryKey(me.name, lg), { type: "json" })) || [];
        const entry = hist.find((h) => h.ts === b.ts);
        if (!entry) return J({ error: "snapshot not found" }, 404);
        const current = await kv.get(rankingsKey(me.name, lg), { type: "json" });
        if (current) hist.unshift({ ts: Date.now(), data: current });
        await kv.put(rankingsHistoryKey(me.name, lg), JSON.stringify(hist.slice(0, 20)));
        await kv.put(rankingsKey(me.name, lg), JSON.stringify(entry.data));
        return J(entry.data);
      }

      // ---- /api/setup : persistent league setup (keepers + trades + tendencies + in-progress picks) ----
      if (path === "/api/setup") {
        if (request.method === "GET") {
          const s = await kv.get(setupKey(lg), { type: "json" });
          return J(s || {});
        }
        if (request.method === "PUT") {
          let b; try { b = await request.json(); } catch { return J({ error: "bad json" }, 400); }
          // Keep a rolling backup of whatever this PUT is about to overwrite, so a bad
          // write (bug, fat-fingered import, etc.) can be rolled back via /api/setup/restore.
          const prev = await kv.get(setupKey(lg), { type: "json" });
          if (prev) {
            const hist = (await kv.get(historyKey(lg), { type: "json" })) || [];
            hist.unshift({ ts: Date.now(), data: prev });
            await kv.put(historyKey(lg), JSON.stringify(hist.slice(0, 30)));
          }
          await kv.put(setupKey(lg), JSON.stringify(b));
          return J({ ok: true });
        }
        return J({ error: "method" }, 405);
      }

      // ---- /api/setup/history : list backup snapshots ----
      if (path === "/api/setup/history") {
        if (request.method === "GET") {
          return J((await kv.get(historyKey(lg), { type: "json" })) || []);
        }
        return J({ error: "method" }, 405);
      }

      // ---- /api/setup/restore : roll back to a snapshot ----
      if (path === "/api/setup/restore") {
        if (request.method === "POST") {
          let b; try { b = await request.json(); } catch { return J({ error: "bad json" }, 400); }
          const hist = (await kv.get(historyKey(lg), { type: "json" })) || [];
          const entry = hist.find((h) => h.ts === b.ts);
          if (!entry) return J({ error: "snapshot not found" }, 404);
          const current = await kv.get(setupKey(lg), { type: "json" });
          if (current) hist.unshift({ ts: Date.now(), data: current });
          await kv.put(historyKey(lg), JSON.stringify(hist.slice(0, 30)));
          await kv.put(setupKey(lg), JSON.stringify(entry.data));
          return J(entry.data);
        }
        return J({ error: "method" }, 405);
      }

      // ---- /api/commish : commissioner-mode membership tracking (per league) ----
      // Separate KV entity from /api/setup on purpose — this is league
      // administration (returning y/n, dues, contact info), not draft/roster
      // state, and shouldn't get mixed into keeper/trade backups or wiped by
      // a league-profile restore. Same versioned-backup pattern as /api/setup.
      if (path === "/api/commish") {
        if (request.method === "GET") {
          const s = await kv.get(commishKey(lg), { type: "json" });
          return J(s || {});
        }
        if (request.method === "PUT") {
          let b; try { b = await request.json(); } catch { return J({ error: "bad json" }, 400); }
          const prev = await kv.get(commishKey(lg), { type: "json" });
          if (prev) {
            const hist = (await kv.get(commishHistoryKey(lg), { type: "json" })) || [];
            hist.unshift({ ts: Date.now(), data: prev });
            await kv.put(commishHistoryKey(lg), JSON.stringify(hist.slice(0, 30)));
          }
          await kv.put(commishKey(lg), JSON.stringify(b));
          return J({ ok: true });
        }
        return J({ error: "method" }, 405);
      }

      // ---- /api/commish/history : list backup snapshots ----
      if (path === "/api/commish/history") {
        if (request.method === "GET") {
          return J((await kv.get(commishHistoryKey(lg), { type: "json" })) || []);
        }
        return J({ error: "method" }, 405);
      }

      // ---- /api/commish/restore : roll back to a snapshot ----
      if (path === "/api/commish/restore") {
        if (request.method === "POST") {
          let b; try { b = await request.json(); } catch { return J({ error: "bad json" }, 400); }
          const hist = (await kv.get(commishHistoryKey(lg), { type: "json" })) || [];
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

      // ---- /api/mocks : list / create ----
      if (path === "/api/mocks") {
        if (request.method === "GET") {
          const idx = (await kv.get(mocksIndexKey(lg), { type: "json" })) || [];
          // A saved mock is a record of how someone drafted — their business,
          // not the league's. Everyone sees their own; the admin also sees the
          // pre-accounts ones, which have no owner recorded.
          if (authEnabled && me && me.role !== "admin") return J(idx.filter((m) => m.by === me.name));
          return J(idx);
        }
        if (request.method === "POST") {
          let b; try { b = await request.json(); } catch { return J({ error: "bad json" }, 400); }
          const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          const ts = Date.now();
          const name = (b.name && String(b.name).slice(0, 80)) ||
            "Mock " + new Date(ts).toISOString().slice(0, 16).replace("T", " ");
          const summary = (b.summary && String(b.summary).slice(0, 300)) || "";
          const rec = { id, name, ts, summary, by: me ? me.name : null, data: b.data || {} };
          await kv.put(mockRecordKey(lg, id), JSON.stringify(rec));
          const idx = (await kv.get(mocksIndexKey(lg), { type: "json" })) || [];
          idx.unshift({ id, name, ts, summary, by: rec.by });
          await kv.put(mocksIndexKey(lg), JSON.stringify(idx.slice(0, 500)));
          return J({ ok: true, id, name, ts, summary, by: rec.by });
        }
        return J({ error: "method" }, 405);
      }

      // ---- /api/mocks/:id : get / delete ----
      if (path.startsWith("/api/mocks/")) {
        const id = path.split("/").pop();
        if (request.method === "GET") {
          const rec = await kv.get(mockRecordKey(lg, id), { type: "json" });
          if (!rec) return J({ error: "not found" }, 404);
          if (authEnabled && me && me.role !== "admin" && rec.by !== me.name)
            return J({ error: "that mock belongs to someone else" }, 403);
          return J(rec);
        }
        if (request.method === "DELETE") {
          // A member can clear out their own mocks but not anyone else's; an
          // admin (and the un-authed, single-user setup) can delete any.
          if (authEnabled && me && me.role !== "admin") {
            const rec = await kv.get(mockRecordKey(lg, id), { type: "json" });
            if (rec && rec.by && rec.by !== me.name) return J({ error: "that mock belongs to someone else" }, 403);
          }
          await kv.delete(mockRecordKey(lg, id));
          const idx = ((await kv.get(mocksIndexKey(lg), { type: "json" })) || []).filter((x) => x.id !== id);
          await kv.put(mocksIndexKey(lg), JSON.stringify(idx));
          return J({ ok: true });
        }
        return J({ error: "method" }, 405);
      }

      // ---- /api/leagues : list all league profiles / create one ----
      if (path === "/api/leagues") {
        if (request.method === "GET") {
          const list = await kv.list({ prefix: "league:" });
          const profiles = await Promise.all(list.keys.map((k) => kv.get(k.name, { type: "json" })));
          return J(profiles.filter(Boolean));
        }
        if (request.method === "POST") {
          let b; try { b = await request.json(); } catch { return J({ error: "bad json" }, 400); }
          const name = (b.name && String(b.name).trim()) || "New League";
          const base = slugify(name);
          let id = base, n = 2;
          while (await kv.get(leagueProfileKey(id))) { id = `${base}-${n++}`; }
          const profile = { ...b, id, name };
          await kv.put(leagueProfileKey(id), JSON.stringify(profile));
          return J(profile, 201);
        }
        return J({ error: "method" }, 405);
      }

      // ---- /api/leagues/:id/history : list backup snapshots for a league profile ----
      if (/^\/api\/leagues\/[^/]+\/history$/.test(path)) {
        if (request.method !== "GET") return J({ error: "method" }, 405);
        const id = decodeURIComponent(path.split("/")[3]);
        return J((await kv.get(leagueHistoryKey(id), { type: "json" })) || []);
      }

      // ---- /api/leagues/:id/restore : roll back a league profile to a snapshot ----
      // (this is the safety net for the exact mistake that motivated it: a Sleeper
      // import saved over an existing league's profile because the form was still
      // "editing" that league — see importFromSleeper() for the actual fix.)
      if (/^\/api\/leagues\/[^/]+\/restore$/.test(path)) {
        if (request.method !== "POST") return J({ error: "method" }, 405);
        const id = decodeURIComponent(path.split("/")[3]);
        let b; try { b = await request.json(); } catch { return J({ error: "bad json" }, 400); }
        const hist = (await kv.get(leagueHistoryKey(id), { type: "json" })) || [];
        const entry = hist.find((h) => h.ts === b.ts);
        if (!entry) return J({ error: "snapshot not found" }, 404);
        const current = await kv.get(leagueProfileKey(id), { type: "json" });
        if (current) hist.unshift({ ts: Date.now(), data: current });
        await kv.put(leagueHistoryKey(id), JSON.stringify(hist.slice(0, 30)));
        await kv.put(leagueProfileKey(id), JSON.stringify(entry.data));
        return J(entry.data);
      }

      // ---- /api/leagues/:id : update / delete a league profile ----
      if (path.startsWith("/api/leagues/")) {
        const id = decodeURIComponent(path.split("/").pop());
        if (request.method === "PUT") {
          let b; try { b = await request.json(); } catch { return J({ error: "bad json" }, 400); }
          const profile = { ...b, id };
          // Same rolling-backup pattern as /api/setup: keep whatever this PUT is
          // about to overwrite, so a bad save (import over the wrong league, a
          // fat-fingered edit) is a restore away instead of a manual reconstruction.
          const prev = await kv.get(leagueProfileKey(id), { type: "json" });
          if (prev) {
            const hist = (await kv.get(leagueHistoryKey(id), { type: "json" })) || [];
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

      // ---- /api/import/sleeper/:sleeperLeagueId : best-effort structure import ----
      // Returns league structure (owners, rosters) for review in the League Manager form —
      // never writes anything itself. Sleeper doesn't expose ADP/ECR/projections or a
      // reliable draft-type/superflex flag, so those aren't guessed here; the user fills
      // them in and hits Save (POST/PUT /api/leagues) same as a manual entry.
      if (path.startsWith("/api/import/sleeper/")) {
        if (request.method !== "GET") return J({ error: "method" }, 405);
        const sleeperId = decodeURIComponent(path.split("/").pop());
        try {
          const [league, rosters, users] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${sleeperId}`).then((r) => r.json()),
            fetch(`https://api.sleeper.app/v1/league/${sleeperId}/rosters`).then((r) => r.json()),
            fetch(`https://api.sleeper.app/v1/league/${sleeperId}/users`).then((r) => r.json()),
          ]);
          if (!league || league.error) return J({ error: "Sleeper league not found" }, 404);

          // Sleeper asks integrators not to hit /players/nfl often — it's a large,
          // slow-changing dictionary, so cache it for 24h.
          let players = await kv.get("sleeper:players:cache", { type: "json" });
          const cachedAt = await kv.get("sleeper:players:ts");
          const stale = !cachedAt || Date.now() - Number(cachedAt) > 24 * 60 * 60 * 1000;
          if (!players || stale) {
            players = await fetch("https://api.sleeper.app/v1/players/nfl").then((r) => r.json());
            await kv.put("sleeper:players:cache", JSON.stringify(players));
            await kv.put("sleeper:players:ts", String(Date.now()));
          }

          const nameFor = (userId, rosterId) => {
            const u = (users || []).find((x) => x.user_id === userId);
            return (u && (u.display_name || u.username)) || `Team ${rosterId}`;
          };

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
            _note: "Structure only — review draft type, superflex, scoring, keeper rules, and dates before saving. Keeper flags reflect Sleeper's keeper list where available; drafted round is not tracked by Sleeper so it's marked FA.",
          });
        } catch (e) {
          return J({ error: "Sleeper import failed: " + e.message }, 502);
        }
      }

      // ---- /api/import/mfl/:mflLeagueId : best-effort structure import ----
      // Same policy as Sleeper import above: structure only (owners + rosters),
      // never writes anything itself, review-before-save. MyFantasyLeague needs no
      // OAuth — plain GETs to api.myfantasyleague.com, following its redirect to the
      // league's actual host. MFL doesn't expose draft round or a keeper flag via
      // this export, so every rostered player comes back FA/NONE, same as Sleeper's
      // fallback, for the user to fill in on Teams & Keepers after saving.
      if (path.startsWith("/api/import/mfl/")) {
        if (request.method !== "GET") return J({ error: "method" }, 405);
        const mflId = decodeURIComponent(path.split("/").pop());
        const year = url.searchParams.get("year") || String(new Date().getFullYear());
        const mflGet = (type) =>
          fetch(`https://api.myfantasyleague.com/${year}/export?TYPE=${type}&L=${mflId}&JSON=1`, {
            headers: { "User-Agent": "aeo-draft-lab/1.0" },
          }).then((r) => r.json());
        try {
          const [leagueData, rostersData] = await Promise.all([mflGet("league"), mflGet("rosters")]);
          const league = leagueData && leagueData.league;
          if (!league || leagueData.error) return J({ error: "MFL league not found" }, 404);

          // MFL's player pool is large and slow-changing — cache it 24h, same as Sleeper's.
          const playersCacheKey = `mfl:players:${year}`;
          let players = await kv.get(playersCacheKey, { type: "json" });
          const cachedAt = await kv.get(`${playersCacheKey}:ts`);
          const stale = !cachedAt || Date.now() - Number(cachedAt) > 24 * 60 * 60 * 1000;
          if (!players) {
            const pd = await mflGet("players");
            const list = (pd && pd.players && pd.players.player) || [];
            players = {};
            list.forEach((p) => {
              players[p.id] = p;
            });
            await kv.put(playersCacheKey, JSON.stringify(players));
            await kv.put(`${playersCacheKey}:ts`, String(Date.now()));
          } else if (stale) {
            // Serve the cached copy for this response but let it refresh in the background.
            mflGet("players").then((pd) => {
              const list = (pd && pd.players && pd.players.player) || [];
              const fresh = {};
              list.forEach((p) => {
                fresh[p.id] = p;
              });
              return Promise.all([
                kv.put(playersCacheKey, JSON.stringify(fresh)),
                kv.put(`${playersCacheKey}:ts`, String(Date.now())),
              ]);
            });
          }

          const nameFor = (id) => {
            const p = players[id];
            if (!p) return `Player ${id}`;
            const [last, first] = String(p.name || "").split(",").map((s) => s.trim());
            return first ? `${first} ${last}` : p.name || `Player ${id}`;
          };

          // Some MFL leagues (e.g. a promotion/relegation gimmick, or a
          // multi-conference dynasty spanning many teams) run several
          // independently-drafted divisions/conferences under one umbrella
          // league — same shared NFL player pool, but a division's roster
          // set is only unique *within* that division. The same real player
          // can legitimately be owned by one team in every division (verified
          // against real data: A.J. Brown, MFL id 14104, rostered by one
          // franchise in each of 5 divisions in a real 60-franchise league).
          // Importing all divisions at once as a single 60-team league would
          // make every such shared player collide under the app's name-keyed
          // roster model, so a divisioned league is imported one division at
          // a time — same as importing an ordinary single-division league,
          // just pre-filtered to that division's franchises.
          // MFL leagues label their divisions two ways: a generic "divisions"
          // list (often left at defaults like "Division 1") and, sometimes,
          // a friendlier "conferences" list a commissioner actually renamed
          // (e.g. "SEC", "ACC") — both keyed by the same id franchises carry
          // in their own `division` field. Prefer the conference names when
          // they exist.
          const divisionDefs =
            (league.conferences && league.conferences.conference && league.conferences.conference.length && league.conferences.conference) ||
            (league.divisions && league.divisions.division) ||
            [];
          const franchisesAll = (league.franchises && league.franchises.franchise) || [];
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
              _note: "This league has multiple divisions/conferences, each independently drafted/managed. Pick one to import as its own league profile — re-request with ?division=<id>.",
            });
          }
          const franchises = requestedDivision
            ? franchisesAll.filter((f) => f.division === requestedDivision)
            : franchisesAll;
          const divisionName = requestedDivision
            ? ((divisionDefs.find((d) => d.id === requestedDivision) || {}).name || requestedDivision)
            : null;

          const ownerById = {};
          const owners = [];
          const ownerSlot = {};
          franchises.forEach((f, i) => {
            const owner = f.name || `Team ${f.id}`;
            ownerById[f.id] = owner;
            owners.push(owner);
            ownerSlot[owner] = i + 1;
          });

          const rosterFranchises = ((rostersData && rostersData.rosters && rostersData.rosters.franchise) || []).filter(
            (f) => ownerById[f.id]
          );
          const rosterLines = [];
          rosterFranchises.forEach((f) => {
            const owner = ownerById[f.id];
            const list = f.player ? (Array.isArray(f.player) ? f.player : [f.player]) : [];
            list.forEach((p) => {
              rosterLines.push(`${owner}|${nameFor(p.id)}|FA|NONE`);
            });
          });

          return J({
            name: divisionName ? `${league.name || "Imported League"} — ${divisionName}` : (league.name || "Imported League"),
            teams: franchises.length || 12,
            owners,
            ownerSlot,
            rostersRaw: rosterLines.join("\n"),
            _source: "mfl",
            _mflLeagueId: mflId,
            _mflYear: year,
            _mflDivision: requestedDivision || null,
            _note: "Structure only — review draft type, superflex, scoring, keeper rules, and dates before saving. MFL doesn't expose a keeper flag or draft round via this export, so every player comes back FA/NONE — set keepers on Teams & Keepers after saving.",
          });
        } catch (e) {
          return J({ error: "MFL import failed: " + e.message }, 502);
        }
      }

      // ---- /api/import/yahoo/:leagueKey : best-effort structure import ----
      // Same policy as the Sleeper and MFL importers: structure only, returned
      // for review in the League Manager form, never written anywhere itself.
      // Unlike those two this one can also recover the real draft round per
      // player (Yahoo exposes draft results), which is the number a keeper cost
      // rule is derived from — the cost itself isn't guessed, since the rule is
      // per-league.
      //
      // Accepts a bare league id ("123456", assumed to be this season's NFL) or
      // a full league key ("nfl.l.123456", or an older season's "449.l.123456").
      if (path.startsWith("/api/import/yahoo/")) {
        if (request.method !== "GET") return J({ error: "method" }, 405);
        if (!env.YAHOO_CLIENT_ID || !env.YAHOO_CLIENT_SECRET) {
          return J({
            error: "Yahoo app credentials aren't configured on the Worker. Set them with: npx wrangler secret put YAHOO_CLIENT_ID (and YAHOO_CLIENT_SECRET). A public league needs only these — no Yahoo sign-in.",
          }, 400);
        }
        const rawId = decodeURIComponent(path.split("/").pop());
        if (!/^[A-Za-z0-9._-]{1,40}$/.test(rawId)) return J({ error: "bad league id" }, 400);
        const leagueKey = /^\d+$/.test(rawId) ? `nfl.l.${rawId}` : rawId;
        const debug = url.searchParams.get("debug") === "1";
        try {
          const [settingsRaw, rostersRawResp, draftRaw] = await Promise.all([
            yahooApiGet(env, kv, url, `/league/${leagueKey}/settings`),
            yahooApiGet(env, kv, url, `/league/${leagueKey}/teams/roster`),
            yahooApiGet(env, kv, url, `/league/${leagueKey}/draftresults`).catch(() => null),
          ]);

          const leagueNode = settingsRaw && settingsRaw.fantasy_content && settingsRaw.fantasy_content.league;
          if (!leagueNode) return J({ error: "Yahoo didn't return a league — check the id, and that the league is public." }, 404);
          const meta = yFlat(Array.isArray(leagueNode) ? leagueNode[0] : leagueNode);
          const settings = yFlat((Array.isArray(leagueNode) ? leagueNode[1] : {}) || {}).settings || {};
          const set = yFlat(settings);

          // Starting lineup, from Yahoo's roster_positions.
          const starters = {};
          yList(set.roster_positions || {}).forEach((rp) => {
            const p = yFlat(rp).roster_position || yFlat(rp);
            const slot = YAHOO_SLOT_MAP[p.position];
            if (!slot) return; // BN / IR / anything we don't model
            starters[slot] = (starters[slot] || 0) + (Number(p.count) || 1);
          });

          // Teams + rosters come back together from /teams/roster.
          const teamsNode = yFlat(
            (Array.isArray(rostersRawResp.fantasy_content.league) ? rostersRawResp.fantasy_content.league[1] : {}) || {}
          ).teams || {};
          const owners = [];
          const ownerSlot = {};
          const ownerByTeamKey = {};
          const rosterLines = [];
          const playerRound = {}; // "teamKey|playerKey" -> draft round
          const playerKeyRound = {};

          yList(draftRaw && draftRaw.fantasy_content && draftRaw.fantasy_content.league
            ? yFlat(draftRaw.fantasy_content.league[1] || {}).draft_results || {}
            : {}).forEach((dr) => {
            const d = yFlat(dr).draft_result || yFlat(dr);
            if (d && d.player_key) playerKeyRound[d.player_key] = Number(d.round) || null;
          });

          yList(teamsNode).forEach((entry, i) => {
            const team = (yFlat(entry).team) || [];
            const tMeta = yFlat(Array.isArray(team) ? team[0] : team);
            const owner = (tMeta.name && String(tMeta.name)) || `Team ${i + 1}`;
            if (!owners.includes(owner)) owners.push(owner);
            ownerSlot[owner] = i + 1;
            ownerByTeamKey[tMeta.team_key] = owner;
            const rosterWrap = yFlat(Array.isArray(team) ? team.slice(1) : {}).roster || {};
            const playersNode = yFlat(yList(rosterWrap)).players || yFlat(rosterWrap).players || {};
            yList(playersNode).forEach((pe) => {
              const pl = yFlat(pe).player || [];
              const pMeta = yFlat(Array.isArray(pl) ? pl[0] : pl);
              const name = (pMeta.name && (pMeta.name.full || pMeta.name.ascii_full)) || pMeta.player_key;
              if (!name) return;
              const round = playerKeyRound[pMeta.player_key];
              rosterLines.push(`${owner}|${name}|${round != null ? round : "FA"}|NONE`);
            });
          });

          // Yahoo reports draft_type as live/offline/autopick and flags auctions
          // separately — "live" alone doesn't tell you it was an auction.
          const isAuction = String(set.is_auction_draft) === "1" || /auction/i.test(String(set.draft_type || ""));
          const scoringLabels = { head: "Head-to-head", point: "Points", points: "Points", roto: "Rotisserie" };

          const out = {
            name: meta.name || "Imported League",
            teams: Number(meta.num_teams) || owners.length || 12,
            owners,
            ownerSlot,
            rostersRaw: rosterLines.join("\n"),
            starters,
            draftType: isAuction ? "auction" : "snake",
            leagueType: Number(set.is_keeper_league) === 1 ? "keeper" : "redraft",
            keeperCostType: isAuction ? "dollar" : "round",
            scoringLabel: scoringLabels[String(meta.scoring_type || set.scoring_type)] || "TBD",
            superflex: !!starters.SUPERFLEX,
            _source: "yahoo",
            _yahooLeagueKey: leagueKey,
            _yahooSeason: meta.season || null,
            _authMode: (await kv.get(YAHOO_AUTH_KEY)) ? "user-token" : "app-signature (2-legged OAuth1)",
            _note:
              "Structure only — review draft type, scoring, keeper rules and dates before saving. Draft rounds came through where Yahoo had draft results (field 3 of each roster line); keeper COST is left as NONE because the cost rule is per-league (e.g. 'one round earlier than last year') and isn't Yahoo's to tell us.",
          };
          if (debug) out._raw = { settings: settingsRaw, rosters: rostersRawResp, draft: draftRaw };
          return J(out);
        } catch (e) {
          return J({ error: "Yahoo import failed: " + e.message }, 502);
        }
      }

      // ---- /api/yahoo/status : is a Yahoo account connected? ----
      if (path === "/api/yahoo/status") {
        if (request.method !== "GET") return J({ error: "method" }, 405);
        const auth = await kv.get(YAHOO_AUTH_KEY, { type: "json" });
        return J({ connected: !!auth });
      }

      // ---- /api/yahoo/leagues : diagnostic — list the connected account's NFL
      // fantasy leagues. Returns Yahoo's raw JSON alongside a best-effort flat
      // list, since Yahoo's XML-to-JSON shape is easy to get wrong un-tested —
      // the raw payload lets us verify the real shape before building the full
      // roster-import mapping (see /api/import/sleeper/:id for that pattern once
      // this is confirmed working end-to-end).
      if (path === "/api/yahoo/leagues") {
        if (request.method !== "GET") return J({ error: "method" }, 405);
        try {
          const token = await getYahooAccessToken(env, kv, url);
          if (!token) return J({ error: "Yahoo account not connected. Visit /auth/yahoo/start first." }, 401);
          const r = await fetch(
            "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nfl/leagues?format=json",
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const text = await r.text();
          if (!r.ok) return J({ error: "Yahoo API returned " + r.status, body: text.slice(0, 1000) }, 502);
          let raw; try { raw = JSON.parse(text); } catch { return J({ error: "Yahoo response wasn't valid JSON", body: text.slice(0, 1000) }, 502); }
          let leagues = [];
          try {
            const games = raw.fantasy_content.users[0].user[1].games;
            for (const gk of Object.keys(games)) {
              if (gk === "count") continue;
              const game = games[gk].game;
              const leaguesObj = (game[1] && game[1].leagues) || {};
              for (const lk of Object.keys(leaguesObj)) {
                if (lk === "count") continue;
                const league = leaguesObj[lk].league[0];
                leagues.push({ key: league.league_key, name: league.name, season: league.season });
              }
            }
          } catch (e) {
            leagues = null; // shape didn't match what we expected — raw is still returned below
          }
          return J({ leagues, raw });
        } catch (e) {
          return J({ error: "Yahoo leagues request failed: " + e.message }, 502);
        }
      }

      return J({ error: "not found" }, 404);
    }

    // Non-API: serve the static app.
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};

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
//   GET/POST /api/mocks            -> list / save mock drafts
//   GET/DELETE /api/mocks/:id      -> load / delete a mock
//   GET     /api/whoami             -> {admin:true|false} — whether the caller's
//                                     x-auth-token matches AUTH_TOKEN; drives the
//                                     admin-only tab gating in the UI. Always
//                                     admin:true when AUTH_TOKEN isn't set.
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
// directly and can't attach custom headers to). Yahoo OAuth needs YAHOO_CLIENT_ID
// and YAHOO_CLIENT_SECRET secrets (npx wrangler secret put ...) — not set in
// wrangler.toml, never committed.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,x-auth-token",
};
const J = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });

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

    // ---- /api/whoami : reports whether the caller's x-auth-token (if any) matches
    // AUTH_TOKEN, so the UI can gate the admin-only tabs (Commish, Leagues, Data,
    // Trades, Teams & Keepers). Deliberately outside the blanket authed() gate below
    // — it needs to answer {admin:false} for a bad/missing token, not 401, or the
    // UI would have no way to distinguish "not admin" from "endpoint unreachable."
    // If AUTH_TOKEN isn't set, authed() always returns true, so this always reports
    // admin:true — i.e. nothing changes here until the owner actually sets the secret.
    if (path === "/api/whoami") {
      if (request.method === "OPTIONS") return J({}, 204);
      return J({ admin: authed(request, env) });
    }

    if (path.startsWith("/api/")) {
      if (request.method === "OPTIONS") return J({}, 204);
      if (!authed(request, env)) return J({ error: "unauthorized" }, 401);
      if (!env.MOCKS) return J({ error: "KV namespace 'MOCKS' is not bound." }, 500);
      const kv = env.MOCKS;
      const lg = leagueId(url);

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
          return J((await kv.get(mocksIndexKey(lg), { type: "json" })) || []);
        }
        if (request.method === "POST") {
          let b; try { b = await request.json(); } catch { return J({ error: "bad json" }, 400); }
          const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          const ts = Date.now();
          const name = (b.name && String(b.name).slice(0, 80)) ||
            "Mock " + new Date(ts).toISOString().slice(0, 16).replace("T", " ");
          const summary = (b.summary && String(b.summary).slice(0, 300)) || "";
          const rec = { id, name, ts, summary, data: b.data || {} };
          await kv.put(mockRecordKey(lg, id), JSON.stringify(rec));
          const idx = (await kv.get(mocksIndexKey(lg), { type: "json" })) || [];
          idx.unshift({ id, name, ts, summary });
          await kv.put(mocksIndexKey(lg), JSON.stringify(idx.slice(0, 500)));
          return J({ ok: true, id, name, ts, summary });
        }
        return J({ error: "method" }, 405);
      }

      // ---- /api/mocks/:id : get / delete ----
      if (path.startsWith("/api/mocks/")) {
        const id = path.split("/").pop();
        if (request.method === "GET") {
          const rec = await kv.get(mockRecordKey(lg, id), { type: "json" });
          return rec ? J(rec) : J({ error: "not found" }, 404);
        }
        if (request.method === "DELETE") {
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

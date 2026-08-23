// Cloudflare Worker for AEO Draft Lab — authoritative server-side entry point.
// Serves the static SPA (public/index.html via the ASSETS binding) and a
// KV-backed API for cross-device setup persistence (keepers, trades, in-progress
// picks), versioned backups, league profiles, mock draft history, and best-effort
// Sleeper league imports. functions/api/* is legacy Cloudflare Pages Functions
// code, unused now that the app deploys as a Worker — don't resurrect it.
//
// API:
//   GET/PUT /api/setup             -> current league setup (keepers/trades/picks)
//   GET     /api/setup/history     -> rolling backup snapshots (last 30)
//   POST    /api/setup/restore     -> roll back to a snapshot {ts}
//   GET/POST /api/leagues          -> list / create league profiles
//   PUT/DELETE /api/leagues/:id    -> update / delete a league profile
//   GET     /api/import/sleeper/:sleeperLeagueId -> best-effort structure import
//   GET/POST /api/mocks            -> list / save mock drafts
//   GET/DELETE /api/mocks/:id      -> load / delete a mock
//
// All routes accept a ?league= query param to scope KV keys per league profile;
// aeo-keepers keeps its original unprefixed keys (setup:main, index, mock:<id>)
// so its pre-existing saved data needed zero migration when multi-league support
// was added. Requires a KV namespace bound as MOCKS (see wrangler.toml). Optional
// AUTH_TOKEN env var requires a matching x-auth-token header on all /api/* routes.

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

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 40) || "league";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

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

      // ---- /api/leagues/:id : update / delete a league profile ----
      if (path.startsWith("/api/leagues/")) {
        const id = decodeURIComponent(path.split("/").pop());
        if (request.method === "PUT") {
          let b; try { b = await request.json(); } catch { return J({ error: "bad json" }, 400); }
          const profile = { ...b, id };
          await kv.put(leagueProfileKey(id), JSON.stringify(profile));
          return J(profile);
        }
        if (request.method === "DELETE") {
          if (id === "aeo-keepers") return J({ error: "cannot delete aeo-keepers" }, 400);
          await kv.delete(leagueProfileKey(id));
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

      return J({ error: "not found" }, 404);
    }

    // Non-API: serve the static app.
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};

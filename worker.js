// Cloudflare Worker for AEO Draft Lab.
// Serves the static SPA (public/index.html via the ASSETS binding) and a
// KV-backed API for cross-device mock draft history. This file is
// authoritative — functions/api/* is legacy Cloudflare Pages Functions code,
// unused now that the app deploys as a Worker.
//
// API:
//   GET    /api/setup      -> {} (health/config check)
//   GET    /api/mocks      -> list saved mocks (index)
//   POST   /api/mocks      -> save a mock {name, summary, data}
//   GET    /api/mocks/:id  -> full mock record
//   DELETE /api/mocks/:id  -> remove a mock
//
// Requires a KV namespace bound as MOCKS (see wrangler.toml). Optional
// AUTH_TOKEN env var requires a matching x-auth-token header on /api/mocks*.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,x-auth-token",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

function authed(request, env) {
  if (!env.AUTH_TOKEN) return true;
  return request.headers.get("x-auth-token") === env.AUTH_TOKEN;
}

async function handleMocksIndex(request, env) {
  const kv = env.MOCKS;
  if (!kv) return json({ error: "KV namespace 'MOCKS' is not bound." }, 500);

  if (request.method === "GET") {
    const idx = (await kv.get("index", { type: "json" })) || [];
    return json(idx);
  }

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad json" }, 400);
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const ts = Date.now();
    const name =
      (body.name && String(body.name).slice(0, 80)) ||
      "Mock " + new Date(ts).toISOString().slice(0, 16).replace("T", " ");
    const summary = (body.summary && String(body.summary).slice(0, 300)) || "";
    const rec = { id, name, ts, summary, data: body.data || {} };
    await kv.put("mock:" + id, JSON.stringify(rec));
    const idx = (await kv.get("index", { type: "json" })) || [];
    idx.unshift({ id, name, ts, summary });
    await kv.put("index", JSON.stringify(idx.slice(0, 500)));
    return json({ ok: true, id, name, ts, summary });
  }

  return json({ error: "method not allowed" }, 405);
}

async function handleMockRecord(request, env, id) {
  const kv = env.MOCKS;
  if (!kv) return json({ error: "KV namespace 'MOCKS' is not bound." }, 500);

  if (request.method === "GET") {
    const rec = await kv.get("mock:" + id, { type: "json" });
    return rec ? json(rec) : json({ error: "not found" }, 404);
  }

  if (request.method === "DELETE") {
    await kv.delete("mock:" + id);
    const idx = ((await kv.get("index", { type: "json" })) || []).filter((x) => x.id !== id);
    await kv.put("index", JSON.stringify(idx));
    return json({ ok: true });
  }

  return json({ error: "method not allowed" }, 405);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return json({}, 204);

      if (pathname === "/api/setup") {
        if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
        return json({});
      }

      if (!authed(request, env)) return json({ error: "unauthorized" }, 401);

      if (pathname === "/api/mocks") return handleMocksIndex(request, env);

      const mockMatch = pathname.match(/^\/api\/mocks\/([^/]+)$/);
      if (mockMatch) return handleMockRecord(request, env, mockMatch[1]);

      return json({ error: "not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

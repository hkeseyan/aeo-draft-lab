// GET /api/mocks -> list saved mocks (index)
// POST /api/mocks -> save a mock {name, summary, data}
// Requires a KV namespace bound as MOCKS. Optional AUTH_TOKEN env var.

const J = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,x-auth-token" },
  });

function authed(request, env) {
  if (!env.AUTH_TOKEN) return true; // token disabled
  return request.headers.get("x-auth-token") === env.AUTH_TOKEN;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return J({}, 204);
  if (!authed(request, env)) return J({ error: "unauthorized" }, 401);
  const kv = env.MOCKS;
  if (!kv) return J({ error: "KV namespace 'MOCKS' is not bound. Add it in Pages > Settings > Functions." }, 500);

  if (request.method === "GET") {
    const idx = (await kv.get("index", { type: "json" })) || [];
    return J(idx);
  }

  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return J({ error: "bad json" }, 400); }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const ts = Date.now();
    const name = (body.name && String(body.name).slice(0, 80)) ||
      "Mock " + new Date(ts).toISOString().slice(0, 16).replace("T", " ");
    const summary = (body.summary && String(body.summary).slice(0, 300)) || "";
    const rec = { id, name, ts, summary, data: body.data || {} };
    await kv.put("mock:" + id, JSON.stringify(rec));
    const idx = (await kv.get("index", { type: "json" })) || [];
    idx.unshift({ id, name, ts, summary });
    await kv.put("index", JSON.stringify(idx.slice(0, 500)));
    return J({ ok: true, id, name, ts, summary });
  }

  return J({ error: "method not allowed" }, 405);
}

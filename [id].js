// GET /api/mocks/:id -> full mock record
// DELETE /api/mocks/:id -> remove a mock
// Requires KV namespace bound as MOCKS. Optional AUTH_TOKEN env var.

const J = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,x-auth-token" },
  });

function authed(request, env) {
  if (!env.AUTH_TOKEN) return true;
  return request.headers.get("x-auth-token") === env.AUTH_TOKEN;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === "OPTIONS") return J({}, 204);
  if (!authed(request, env)) return J({ error: "unauthorized" }, 401);
  const kv = env.MOCKS;
  if (!kv) return J({ error: "KV namespace 'MOCKS' is not bound." }, 500);
  const id = params.id;

  if (request.method === "GET") {
    const rec = await kv.get("mock:" + id, { type: "json" });
    return rec ? J(rec) : J({ error: "not found" }, 404);
  }

  if (request.method === "DELETE") {
    await kv.delete("mock:" + id);
    const idx = ((await kv.get("index", { type: "json" })) || []).filter((x) => x.id !== id);
    await kv.put("index", JSON.stringify(idx));
    return J({ ok: true });
  }

  return J({ error: "method not allowed" }, 405);
}

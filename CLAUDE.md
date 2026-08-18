# AEO-Keepers Draft Lab — project brief

Interactive keeper-league draft tool (12-team, Half-PPR, snake) with rival
rosters, keeper modeling, a mock-draft simulator, and cloud-saved mock
history that syncs across devices.

## Architecture

Deploys as a single **Cloudflare Worker** to
`https://aeo-draft-lab.hkeseyan.workers.dev`.

- `worker.js` — authoritative Worker entry point. Routes `/api/*` to a
  KV-backed API and serves everything else from the `ASSETS` binding
  (`public/`). Do not add a build step; this repo has no bundler.
- `wrangler.toml` — Worker config: `main = worker.js`, static assets served
  from `./public`, KV namespace bound as `MOCKS`.
- `public/index.html` — the whole app UI. Self-contained: player data is
  embedded inline as `PLAYERS_CSV` (see `players-2026.csv`, the source of
  truth for that embed — re-embed it here when refreshing ADP/ECR).
- `players-2026.csv` — source player data, embedded into `index.html`, not
  served directly.
- `functions/` — legacy Cloudflare **Pages Functions** implementation
  (superseded by `worker.js`). Left in place for reference only; unused by
  the current deploy. Don't touch it.

## API (implemented in worker.js)

- `GET /api/setup` — health/config check, returns `{}`.
- `GET /api/mocks` — list saved mock drafts (index only).
- `POST /api/mocks` — save a mock `{name, summary, data}`.
- `GET /api/mocks/:id` — full mock record.
- `DELETE /api/mocks/:id` — remove a mock.
- Optional `AUTH_TOKEN` env var (set via `wrangler secret put AUTH_TOKEN`)
  requires a matching `x-auth-token` header on all of the above.

## Deploying

```
npx wrangler deploy
```

Requires:
1. A real KV namespace id in `wrangler.toml` under `[[kv_namespaces]]`
   (create with `npx wrangler kv namespace create MOCKS`, then paste the id
   in — the placeholder `REPLACE_WITH_KV_NAMESPACE_ID` will fail deploy).
2. Cloudflare auth: `npx wrangler login` interactively, or a
   `CLOUDFLARE_API_TOKEN` env var in non-interactive environments (CI,
   sandboxed sessions).

Verify after deploy: `curl https://aeo-draft-lab.hkeseyan.workers.dev/api/setup`
should return `{}`, not a 404. If it 404s, the Worker isn't routing `/api/*`
correctly — check `worker.js`.

## Testing changes before deploy

- `node --check worker.js` for syntax.
- For `public/index.html`'s inline scripts, extract with a regex and run
  through `new Function(...)`, or boot the whole page in `jsdom`
  (`runScripts: 'dangerously'`) with `fetch`/`localStorage` stubbed, to
  catch reference/runtime errors before they hit production.
- `npx wrangler deploy --dry-run` validates `wrangler.toml` + bindings
  without needing auth or pushing anything live.

## Conventions

- Keep `index.html` self-contained — no external JS/CSS dependencies, no
  build step. Data embedded inline.
- `worker.js` is authoritative for all server-side logic; don't resurrect
  `functions/`.
- Don't add features/abstractions beyond what's asked — this is a personal
  fantasy-football tool, not a product.

## Roadmap

- Multi-league selector for the auction/superflex leagues (next item after
  this Worker deploy is confirmed stable — confirm with the user before
  starting).

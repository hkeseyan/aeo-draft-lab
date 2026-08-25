# AEO-Keepers Draft Lab — project brief

Interactive keeper-league draft tool (12-team, Half-PPR, snake) with rival
rosters, keeper modeling, a mock-draft simulator, and cloud-saved mock
history that syncs across devices.

## Feedback & specs workflow — check this every session

The user moves between Claude Cowork, Claude Code, and other environments,
and captures feedback in the moment while using the app rather than trying
to remember it later. To keep that from getting lost on handoff:

- **`FEEDBACK.md`** — running inbox of feedback/ideas, newest first, each
  tagged 🆕 new / 🔧 in progress / ✅ done / ⛔ won't do. **Read it at the
  start of every session** and triage anything 🆕: act on it if small and
  unambiguous, ask the user if it's larger or ambiguous, or note why it's
  deferred.
- **`SPECS.md`** — the current, authoritative description of what the app
  does. When a `FEEDBACK.md` item is resolved, fold the resulting behavior
  into `SPECS.md` and mark the feedback entry ✅ (keep the line — it's
  history, don't delete it).
- Whenever the user gives feedback in conversation (in any environment),
  append it to `FEEDBACK.md` as a new 🆕 entry before doing anything else,
  even if you're also acting on it immediately in the same turn.

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

## Network access for data refreshes

Pulling live ADP/ECR (FantasyPros, Yahoo, etc.) requires this session's
environment **Network Access set to Full**, not the Trusted default —
Trusted is a default-deny egress policy that blocks essentially all outbound
web traffic, including fantasypros.com. Check with the user before assuming
it's set; if a fetch to a normal web page fails with `EGRESS_BLOCKED` or the
proxy returns 403, that's the cause, not a bug to route around.

With Full access, `curl` (not the `WebFetch` tool — it checks a separate,
stale policy) can reach FantasyPros. Their ADP page is a client-rendered SPA
with no reachable data export, but
`fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php` embeds a
server-rendered `ecrData` JSON blob (ECR, tier, team, position for ~900
players) — that's the known-working path. See `SPECS.md` → Player data for
what was pulled 2026-08-25 and the ADP gap that's still open.

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

Requires Cloudflare auth: `npx wrangler login` interactively, or a
`CLOUDFLARE_API_TOKEN` env var in non-interactive environments (CI,
sandboxed sessions). The `MOCKS` KV namespace id is already set in
`wrangler.toml`.

This repo also has a Cloudflare Workers Build integration connected via
GitHub — pushes to the branch backing the connected deployment (see the
Cloudflare dashboard) trigger an automatic build/deploy independent of
running `wrangler deploy` locally.

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

- Check `FEEDBACK.md` for unaddressed 🆕 items first — that's the live
  backlog, more current than this list.
- Multi-league selector for the auction/superflex leagues (next item after
  this Worker deploy is confirmed stable — confirm with the user before
  starting).

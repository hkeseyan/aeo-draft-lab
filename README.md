# AEO-Keepers Draft Lab

Interactive keeper-league draft tool (12-team, Half-PPR, snake) with rival rosters, keeper modeling, a mock-draft simulator, and **cloud-saved mock history** that syncs across your phone and laptop.

- `public/index.html` — the whole app (self-contained; player data embedded).
- `worker.js` + `wrangler.toml` — a Cloudflare Worker that serves the app and a KV-backed API for mock history.
- `players-2026.csv` — the source player data (also embedded in `index.html`).
- `functions/` — legacy Cloudflare Pages Functions implementation, superseded by `worker.js`. Unused.

The app works offline as a plain file (open `public/index.html` directly); the **mock history** feature turns on once deployed to Cloudflare with a KV store bound.

---

## Deploying

1. **Install & auth**: `npx wrangler login` (interactive), or set `CLOUDFLARE_API_TOKEN` in non-interactive environments.
2. **Deploy**: `npx wrangler deploy`. This publishes to `https://aeo-draft-lab.<your-subdomain>.workers.dev` (or a custom domain if configured). The `MOCKS` KV namespace id is already set in `wrangler.toml`.
3. **Verify**: `curl https://aeo-draft-lab.<your-subdomain>.workers.dev/api/setup` should return `{}`. Open the site → **Mocks** tab → should read "☁ Cloud connected." Run a draft → name it → **Save current draft to cloud**. It now shows on every device.

This repo also has a Cloudflare Workers Build integration connected via GitHub, which auto-deploys on pushes to the connected branch — see the [Workers dashboard](https://dash.cloudflare.com) for that project's build status.

### Optional — make history private

```
npx wrangler secret put AUTH_TOKEN
```

Then in the app: **Mocks** tab → **Privacy token** → paste the same string → **Set token** (once per device).

---

## Updating data or app later

- Edit `public/index.html` (or `players-2026.csv` and re-embed as `PLAYERS_CSV`), commit, push, then `npx wrangler deploy`.
- To refresh ADP/ECR closer to the draft, ask Claude to re-pull FantasyPros/Yahoo and re-embed `PLAYERS_CSV` in `public/index.html`.

## Notes

- KV free tier easily covers a season of mocks. Records are tiny (just your picks + keeper assignments); the player/roster data lives in the app.
- The Data tab's export/import config still works as an offline backup, independent of the cloud KV store.
- **Multiple leagues**: the **Leagues** tab manages league profiles (settings, owners/draft slots, rosters, player pool) in KV — create/edit/delete without touching code. A header dropdown switches the active league; every `/api/*` route accepts a `?league=` param to scope its data. You can also pull a league's owners/rosters from a public Sleeper league ID as a starting point to review before saving.
- **Backups**: every setup save (keepers/trades/tendencies/picks) keeps a rolling history of the last 30 snapshots, restorable from the Trades tab if something gets overwritten.
- See `CLAUDE.md` for the full project brief and conventions.

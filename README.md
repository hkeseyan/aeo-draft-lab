# AEO-Keepers Draft Lab

Interactive keeper-league draft tool (12-team, Half-PPR, snake) with rival rosters, keeper modeling, a mock-draft simulator, and **cloud-saved mock history** that syncs across your phone and laptop.

- `index.html` — the whole app (self-contained; player data embedded).
- `functions/api/mocks.js` + `functions/api/mocks/[id].js` — Cloudflare Pages Functions that store mock history in a KV namespace.
- `players-2026.csv` — the source player data (also embedded in `index.html`).

The app works offline as a plain file; the **mock history** feature turns on once deployed to Cloudflare with a KV store bound.

> Note: this folder lives in Google Drive, which locks files and doesn't play well with a local `git` repo. Use **Option A** below (no git) — it's the fastest path to having it on your phone tomorrow.

---

## Step 1 — Get the files onto GitHub

### Option A — GitHub website, no git (recommended)
1. Create a repo: https://github.com/new → name it `aeo-draft-lab` (Private is fine) → **Create repository**.
2. On the new repo page click **uploading an existing file**.
3. Drag in these items from this folder: `index.html`, the whole `functions` folder, `players-2026.csv`, `README.md`, `.gitignore`.
   (Do **not** upload any `.git` or `Icon` files if you see them.)
4. **Commit changes.**

### Option B — git (copy out of Drive first)
Google Drive breaks `git` in place, so copy the folder somewhere local first:
```bash
cp -R "~/My Drive/Thorium/Claude/Projects/fantasy-sports/aeo-draft-lab" ~/aeo-draft-lab
cd ~/aeo-draft-lab && rm -rf .git
git init && git add -A && git commit -m "AEO-Keepers Draft Lab"
git branch -M main
git remote add origin https://github.com/<your-username>/aeo-draft-lab.git
git push -u origin main
```

## Step 2 — Cloudflare Pages
1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick `aeo-draft-lab`.
2. Build settings: **Framework preset = None**, **Build command = empty**, **Build output directory = `/`** → **Save and Deploy**.
3. You'll get `https://aeo-draft-lab.pages.dev` (or similar). Open it on your phone — the draft tool already works. Next step turns on saved history.

## Step 3 — KV store (enables cross-device mock history)
1. Dashboard → **Workers & Pages** → **KV** → **Create a namespace**, name it `mocks`.
2. Your Pages project → **Settings** → **Functions/Bindings** → **KV namespace bindings** → **Add binding**:
   - **Variable name:** `MOCKS`  (exactly this)
   - **KV namespace:** `mocks`
   - Apply to **Production**. **Save**.
3. **Deployments** → **Retry/Redeploy** the latest deploy so the binding takes effect.
4. Open the site → **Mocks** tab → should read “☁ Cloud connected.” Run a draft → name it → **Save current draft to cloud**. It now shows on every device.

## Step 4 (optional) — Make history private
1. Pages → **Settings** → **Environment variables** → add `AUTH_TOKEN` = a secret string (Production) → redeploy.
2. App → **Mocks** tab → **Privacy token** → paste the same string → **Set token** (once per device).

---

## Updating data or app later
- Web (Option A): edit the file on GitHub or re-upload → Cloudflare auto-redeploys.
- git (Option B): `git add -A && git commit -m "update" && git push`.
- To refresh ADP/ECR closer to the draft, ask Claude to re-pull FantasyPros/Yahoo and re-embed `PLAYERS_CSV` in `index.html`.

## Notes
- KV free tier easily covers a season of mocks. Records are tiny (just your picks + keeper assignments); the player/roster data lives in the app.
- The Data tab's export/import config still works as an offline backup.

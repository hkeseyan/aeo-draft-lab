# AEO-Keepers Draft Lab — project brief

Interactive fantasy-football **keeper draft tool** for the "AEO-Keepers" league (plus
two auction/superflex leagues, see Multi-league below), deployed as a Cloudflare
Worker. This file orients a fresh session; read it first, then skim the files named
below.

## Feedback & specs workflow — check this every session

The user moves between Claude Cowork, Claude Code, and other environments, and
captures feedback in the moment while using the app rather than trying to remember
it later. To keep that from getting lost on handoff:

- **`FEEDBACK.md`** — running inbox of feedback/ideas, newest first, each tagged
  🆕 new / 🔧 in progress / ✅ done / ⛔ won't do. **Read it at the start of every
  session** and triage anything 🆕: act on it if small and unambiguous, ask the user
  if it's larger or ambiguous, or note why it's deferred.
- **`SPECS.md`** — the current, authoritative description of what the app does. When
  a `FEEDBACK.md` item is resolved, fold the resulting behavior into `SPECS.md` and
  mark the feedback entry ✅ (keep the line — it's history, don't delete it).
- Whenever the user gives feedback in conversation (in any environment), append it
  to `FEEDBACK.md` as a new 🆕 entry before doing anything else, even if you're also
  acting on it immediately in the same turn.

## What it is
A single-page web app (`public/index.html`) for pre-draft prep: ranked player board,
per-team rosters + keeper modeling, draft-pick & player trades, a need-aware
snake-draft simulator with per-owner tendencies, a strategy-comparison "lab," and
cloud-saved mock history — all synced across devices via Cloudflare KV. Multiple
leagues are served from one deployment via KV-backed league profiles, editable
in-app (see "Multi-league support" below) — no code change needed to add a league.

## Tech stack & deploy
- **Cloudflare Worker + Static Assets.** `worker.js` is authoritative for all
  server-side logic — routes `/api/*` to a KV-backed API and serves everything else
  from the `ASSETS` binding (`public/`). No build step; don't add one.
- **KV** namespace `mocks` (id `1d439dfe62f1412da95101491c170cef`) bound as
  **`MOCKS`** in `wrangler.toml`. `[assets] directory = "./public"` with
  `not_found_handling = "single-page-application"`.
- **Deploy:** `npx wrangler deploy` from this folder. Live at
  https://aeo-draft-lab.hkeseyan.workers.dev
- Local preview: `npx wrangler dev`.
- This repo also has a Cloudflare Workers Build integration connected via GitHub —
  pushes to the connected branch trigger an automatic build/deploy independent of
  running `wrangler deploy` locally (see the Cloudflare dashboard for that project's
  build status). Ship changes via a PR against `main`, not a force-push — this repo
  uses PRs (see closed PR history) and other sessions/devices may be working from
  the same `main`.
- `functions/` is a leftover Cloudflare Pages Functions implementation, superseded
  by `worker.js`. Left in place for reference only; unused by the current deploy.
  Don't touch it.

## Files
- `public/index.html` — the entire app (HTML+CSS+JS), self-contained (no external
  JS/CSS dependencies). AEO-Keepers' player data is embedded as `PLAYERS_CSV_AEO`
  and roster data as `ROSTERS_RAW_AEO` inside the hardcoded `LEAGUES_DEFAULT`
  registry — the offline/first-run fallback (see Multi-league support). Key
  globals: `LEAGUE` (active league's settings), `LEAGUES` (cloud-backed registry of
  all league profiles), `OWNER_SLOT` (draft order for the active league), `PLAYERS`,
  `ROSTERS`, `assigned` (keeper picks), `pickOwnerOverride`/`playerTrades` (trades),
  `TENDENCIES` (per-owner opponent-model bias). Views: Draft Room, Teams & Keepers,
  Trades, Rankings, Mocks, Strategy Lab, Data, Leagues, Commish, Account.
- `worker.js` — API, all KV-backed, league-scoped via `?league=`. Optional
  per-user accounts gate it (`/api/auth/*`; none created = the pre-accounts
  behaviour, see `SPECS.md` → "Accounts"), with per-account private state at
  `GET/PUT /api/private` and `GET/PUT /api/rankings` (+ history/restore).
  Shared, league-wide: `GET/PUT
  /api/setup` (keepers/trades/tendencies/in-progress picks) with rolling backup
  history (`GET /api/setup/history`, `POST /api/setup/restore`); `GET/POST
  /api/leagues`, `PUT/DELETE /api/leagues/:id` (league profile CRUD); `GET
  /api/import/sleeper/:id` (best-effort structure import); `GET/POST /api/mocks`,
  `GET/DELETE /api/mocks/:id`. Optional `AUTH_TOKEN` env var gates the API.
- `wrangler.toml` — Worker + assets (`./public`) + KV binding.
- `players-2026.csv` — AEO-Keepers source player data (source of truth for the
  `PLAYERS_CSV_AEO` embed); not served directly.
- `.assetsignore` — keeps dotfiles/non-public files out of the servable asset set
  (defense-in-depth; the `public/` directory boundary does the structural work).
- Domain context lives one level up in the parent project `../` (Google Drive):
  `../football/leagues/aeo-keepers/{settings,keepers,strategy}.md`,
  `../football/leagues/aeo-keepers/data/{team-rosters-2026,keeper-pool-2026,players-2026}.csv`,
  `../shared/{strategy-principles,data-sources,glossary}.md`,
  `../football/_shared/strategy.md`.

## League facts (AEO-Keepers)
- 12-team, **Half-PPR**, **snake**, keeper league. Draft **Sept 8 2026**; keeper deadline **Sept 1**.
- Scoring quirks: **6-pt passing TDs** + 300/450 passing-yard bonuses (FantasyPros proj assumes 4-pt pass TDs → our QBs outscore `proj`); **0.5 per rushing first down**; **40+ yard play bonuses**; FG by yardage. Roster: QB, 3WR, 2RB, TE, W/R/T flex, K, DEF, 6 BN, 2 IR. No superflex.
- **Draft order (slot→owner):** 1 Mher, 2 Sako, 3 Savada, 4 Taron, 5 Dirty, **6 Hovo (the user)**, 7 Shant, 8 Edward, 9 Aren, 10 Jiro, 11 Haiko, 12 Robert. Editable in-app via the Leagues tab (see Multi-league support) — this list reflects the current default, not a hardcoded ceiling.
- User = **Hovo**, drafts 6th. Keepers (editable in app): JSN 5.06, Judkins 8.07, Burden 11.06 (Tuten 5th and Herbert 10th are alternates).
- Keeper rules: up to 3; cost = one round earlier than last year's draft round (escalates yearly); FA keeper = 10th; declare 7 days pre-draft. Rules WATCH: a pending league vote may add superflex (would ban QB keepers) and/or remove DEF+K — confirm status before relying on QB strategy.
- Data sources: FantasyPros ECR/ADP + projections (primary) blended with Yahoo ADP weighted <50% (`adp = 0.67*FP + 0.33*Yahoo`). **There is no automated refresh job** — checked `RemoteTrigger` on 2026-08-24 and found none (a routine description to that effect existed only as unverified prior documentation). Refreshing ADP/ECR/projections is a manual pull from fantasypros.com's half-PPR rankings/ADP/projections pages (see FEEDBACK.md, 2026-08-24 "ADP/ECR data feels stale" for the method: `ecrData` embedded in the rankings page HTML goes 882 deep; the ADP page's per-site breakdown loads via JS and needs a browser fetch, not curl; season-long FPTS projections are paywalled beyond the top 10 per position without a FantasyPros login). Do this refresh by hand when the pool feels stale — there's no cron to rely on.

## Opponent model (need-aware rival picks + per-owner tendencies)
Rivals score a consideration set (top 40 available by ADP) on `-ADP + 26×needScore
(pos) - 8×tendencyBias(owner,pos) - 90 if K/DST before round (rounds-2) ± noise`.
`needScore` is 1 while a starter slot is open, 0.6 if FLEX-eligible and FLEX is
open, -1 once at depth cap (vetoed outright, not just penalized — no tendency bias
can make a team stockpile a 4th QB), else 0.15 bench depth. Tendencies are hand-set
per owner (same people every year) rather than mined from history: an enable
checkbox + QB/RB/WR/TE bias (-3..+3) on Teams & Keepers, persisted in saved config
and cloud setup. Shared by Draft Room and Strategy Lab (`rivalScore`/
`bestRivalChoice` in `public/index.html`) so their results don't diverge. See
`SPECS.md` → "Opponent model" for the full writeup.

## Multi-league support
League profiles (settings + owners/rosters/players) live in KV (`league:<id>`),
editable from the **Leagues** tab — create/edit/delete without a code change or
redeploy. `LEAGUES_DEFAULT` in `public/index.html` remains as the offline/first-run
fallback (and what seeds the cloud on a truly empty KV store) but the cloud copy is
authoritative once it exists. A header dropdown switches the active league;
`/api/*` routes take `?league=` to scope their data. Auction-type league profiles
are supported structurally (draft type, superflex, keeper-cost-in-dollars) but the
auction draft room itself isn't built yet — Draft Room/Strategy Lab show a
placeholder for those leagues. A Sleeper-league-ID import pulls owners/rosters into
the Leagues tab's edit form for review (never auto-saves). See `SPECS.md` → "League
profiles" for the full writeup.

## Roadmap
Check `FEEDBACK.md` for unaddressed 🆕 items first — that's the live backlog, more
current than this list.
1. ~~Get `wrangler deploy` working and verify KV~~ — done.
2. ~~Multi-league support~~ — done (see above); auction draft room itself is still
   a placeholder, not yet built.
3. ~~A **standard redraft** profile for quick drafts (no keepers)~~ — done via
   `leagueType==='redraft'` (see SPECS.md → "League profiles").
4. ~~**Commissioner mode**~~ — done: v1 2026-08-25 (a **Commish** tab, its own
   `commish:<league>` KV entity, `GET/PUT /api/commish` + history/restore),
   v2 2026-08-26 (restore panel, dues rollup + outstanding column, contact
   export; admin-only to read once accounts exist).
5. ~~**Custom rankings v1**~~ — done 2026-08-26: a **Rankings** tab, per
   account and per league (`GET/PUT /api/rankings` + history/restore), with
   seeding, reordering, pasted lists, and user-set tiers. Deliberately the
   small hand-built version — the model below still stands.
6. **League-aware custom rankings/projections engine** — in active design as
   of 2026-08-25, planned over several sessions/days (user wants to discuss
   via phone/Remote Control, not a solo build). This is what actually
   differentiates `guillotine`/`bestball` from plain `redraft` (they exist as
   selectable `leagueType`s already but behave identically to redraft until
   this lands). See `FEEDBACK.md` for the live state of that design thread.
7. **Live draft capability** (real-time sync with an in-progress draft on
   Yahoo/Sleeper/MFL) — was explicitly deprioritized earlier, now scheduled
   for the next 2-3 days per the user (2026-08-25).
8. ~~**Multiple people / separate save files**~~ — done 2026-08-26: optional
   accounts (**Account** tab). With none created the app behaves exactly as
   before; the first account created becomes admin. League facts stay shared,
   while rankings/queue/tendencies/in-progress draft go per account. See
   `SPECS.md` → "Accounts".
9. Later, still deferred: in-season tools — waivers/FAAB, start/sit, trade
   analysis; ESPN/FanTracks import; Yahoo Fantasy import (needs the user to
   register an OAuth app first — see conversation history, not recorded here
   since it involves credentials; also blocked on Yahoo's manual Fantasy
   Sports API access review as of 2026-08-23). **Superseded 2026-08-26**: the pending review
   is not the gate for public leagues. Yahoo reads them with 2-legged OAuth
   1.0a — app consumer key + HMAC-SHA1 signature, no user sign-in — so
   `GET /api/import/yahoo/:leagueKey` is built and needs only the
   `YAHOO_CLIENT_ID`/`YAHOO_CLIENT_SECRET` secrets. See `SPECS.md` →
   "Yahoo import".

## Conventions
- Keep `public/index.html` self-contained (data embedded) — no external JS/CSS
  dependencies, no build step.
- `worker.js` is authoritative for all server-side logic; don't resurrect
  `functions/`.
- When ADP/projection data changes, update `players-2026.csv` AND re-embed it into
  the `PLAYERS_CSV_AEO` template literal in `public/index.html` (or, going forward,
  PUT it directly to the `aeo-keepers` league profile via `/api/leagues/aeo-keepers`
  — the Data tab's "Save players CSV to this league" button does this from the UI).
- Test after edits: `node --check worker.js`; for `public/index.html`'s inline
  scripts, extract with a regex and run through `node --check`, or boot the whole
  page in `jsdom` (`runScripts: 'dangerously'`) with `fetch`/`localStorage` stubbed,
  to catch reference/runtime errors before they hit production. `npx wrangler
  deploy --dry-run` validates `wrangler.toml` + bindings without needing auth or
  pushing anything live. Verify `/api/*` after deploy (`GET /api/setup` returns
  `{}` or the real saved data, not a 404).
- Don't add features/abstractions beyond what's asked — this is a personal
  fantasy-football tool, not a product.

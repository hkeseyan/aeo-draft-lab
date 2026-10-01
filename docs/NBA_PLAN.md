# NBA plan — requirements and the handoff brief

Captured 2026-10-01, at the end of the NHL build. The next session starts here.
`docs/MULTISPORT_PLAN.md` holds the original cross-sport reasoning; this file is
NBA-specific and names the exact code that has to change.

## Progress

**2026-10-01 — build step 1 done.** Built: the `nba` sport pack; composite roster
slots (`slotGroups` in the pack, read by `playerFillsPos()`, `rosterEligiblePositions()`,
`countsOf()` and `posCell()`, with hockey's Fantrax F expressed the same way and its
behaviour unchanged); the `yahoo-nba-public-points` reference league; a 335-player
2026-27 pool (`PLAYERS_CSV_NBA`); `computeMyRanksNba()` for points leagues; NBA
headshots; the "My slot" control for NBA. `SPECS.md` → "Basketball (NBA)" has the
behaviour. Step 2 is partly done as a side effect, because the board needed a real
pool: market ADP and stats-based projections are in; what step 2 still owes is
listed below.

What research established on 2026-10-01:

- **`stats.nba.com` times out from the agent container** (curl, browser headers, 30s).
  Not needed for now: FantasyPros' **NBA projections page is free** (season totals for
  266 players, unlike football's paywalled ones), and Sleeper publishes NBA season
  stats (`/v1/stats/nba/regular/2025` = 2025-26) and per-game projections with
  attempts (`/v1/projections/nba/regular/2026`, 529 players).
- **FantasyPros works exactly as it did for hockey**: `ecrData` in the rankings HTML
  (311 players, 6 experts, roto scoring), and the ADP page is a plain table with
  **Yahoo** and **ESPN** columns (223 rows). FantasyPros carries four stale duplicate
  prospect records (Morez Johnson Jr., Darius Acuff Jr., Mikel Brown Jr., Terrence
  Shannon Jr. listed again as FA); the pool build drops them.
- **Fantrax `getAdp?sport=NBA` works with no auth** (312 rows), same as hockey.
- **Yahoo defaults** (help SLN6919): Public leagues default to **10-team H2H Points**,
  PTS 1 / REB 1.2 / AST 1.5 / STL 3 / BLK 3 / TO -1, roster PG, SG, G, SF, PF, F, C, C,
  Util, Util + 3 BN + 3 IL, daily changes, 4 adds/week. **Public Prize basketball is
  exactly 12 managers** (official rules), H2H Points / H2H Categories / Roto, live
  standard or auction drafts only. First game week: **Tue Oct 20, 2026**.
- **Yahoo "High Score"** is Yahoo's new default for private leagues: draft 10, start 6
  (2 G, 3 frontcourt, 1 Util), and each starter's **single best game of the week**
  counts; PTS 1, REB 1, AST 2, STL 3, BLK 3. Not offered for Public Prize.
- **"Lock-In" is Sleeper's mode**: one game per player per week counts, chosen by the
  manager after it is played and before his next game; the player must have been in
  that day's starting lineup. It is the manual cousin of Yahoo's High Score. Both
  reward single-game ceiling over games played, which is the draft implication for
  build step 5.

**Still owed by step 2:** a second projection source to blend (Sleeper per-game x
games is the obvious one; its attempts already feed FGA/FTA); a refresh path that is
not a by-hand pull (hockey's is `/api/nhl/preseason-projections`); Fantrax ADP wired
for Fantrax leagues (`/api/nhl/fantrax-adp` is hockey-only); tiers (FantasyPros'
NBA `ecrData` carries none). Anchors found for later steps: Yahoo source sync picks
its game key at `worker.js` `profile.sport === "nhl" ? "nhl" : "nfl"`, so an NBA
league would query football; the live recommendation card and streaming controls
are gated to `SPORT.id==='nhl'`.

**Refreshing the pool by hand:** curl the three FantasyPros pages (`/nba/rankings/
overall.php`, `/nba/adp/overall.php`, `/nba/projections/overall.php`) and Sleeper's
`/v1/players/nba`, `/v1/projections/nba/regular/2026` and `/v1/stats/nba/regular/2025`,
then rebuild the CSV with the same joins (FantasyPros id; Sleeper name + team or
position; drop same-name FA records with no data) and bump `poolDataRevision`.

## Status going in

NHL drafting is winding down. The user may be done; they are still looking for a
**Yahoo Roto Public Prize** league for a couple of days, but those are having trouble
filling. If none fills, NHL drafting is finished and NBA begins. Nothing in the NHL
work is left unfinished — `FEEDBACK.md` has no open 🆕/🔧 items, and the last loose
end (a test file missing from `npm test`) is closed.

## What the user asked for

- **Platforms: Yahoo, Fantrax and Sleeper for certain.** Possibly one or two more
  depending on factors not yet decided.
- **League types: H2H Points, season-long Points, H2H Categories, Roto.**
- **Lineup cadence: daily-changers, weekly-lineups, Lock-In, Best Ball.** Mostly
  in-season concerns, but they still matter at the draft.
- **Draft formats: snake, auction, snake with 3rd-round reversal, linear**
  (non-snaking, common in dynasty).
- **Retention: redraft, dynasty, keeper, possibly with a salary/contract component.**
- **Fantrax Best Ball** — NHL had no equivalent. Its roots are in NFL fantasy, the
  user knows the format, and the app does not support it in any real sense yet.
- **NBA "Lock In"** (or whatever the per-league feature is actually called) must be
  planned for.
- **Start with the simple use cases, then build out.**

## What already transfers, and what doesn't

Most of the NHL work was deliberately built sport-agnostic. Verified against the code
on 2026-10-01:

**Transfers as-is**
- Sport packs (`SPORTS`), the header sport switcher, per-sport league-dropdown
  scoping, position colours and filters.
- Per-league roster positions: `rosterPositionOrder()` + `rosterEligiblePositions()`
  already project a player's eligibility onto whatever slots a league rosters. NBA's
  PG/SG/SF/PF/C plus G/F/Util is the same mechanism as hockey's F/D/G.
- Multi-position eligibility and the per-platform `eligibility` map
  (`yahoo`/`fantrax`/`fallback`), including the provenance warning on the board.
- `findPlayer(name, pos)` disambiguation for same-name players.
- Draft geometry: `overall()`, `posInRound()` and `slotForOverall()` are the **only**
  three functions that know draft order. Snake, linear and auction already exist.
- The VORP My Rank shape: value, positional replacement level, flexibility bonus.
- Add Radar's schedule/opportunity logic (it needs an NBA schedule source).
- Fantrax, Sleeper and MFL importers; the review-before-save policy.

**Needs real work**
| What | Where | Note |
|---|---|---|
| An `nba` sport pack | `SPORTS` in `public/index.html` | only `nfl` and `nhl` exist |
| Ungate the category engine | **`isCategoryLeague()` is hardcoded to `SPORT.id==='nhl'`** | this is the single biggest blocker; 9-cat NBA is category-native |
| Season-long Points as a distinct mode | `scoringMode` is `points`/`categories`/`roto` | cumulative-no-matchup is a fourth shape |
| Lock-In cadence | `lineupPeriod` is `daily`/`weekly` | needs a third value and draft-time implications |
| Best Ball behaviour | `leagueType:'bestball'` **already exists but behaves as redraft** | no new type needed — it needs real semantics |
| 3rd-round reversal | the three geometry functions above | localized; rounds 1–2 snake, round 3 repeats round 2's order |
| Salary/contract retention | auction keeper machinery exists for football | dynasty-with-contracts is a further step |
| Sleeper NBA import | `worker.js` hardcodes `players/nfl` | Sleeper does cover NBA; make it sport-aware |
| NBA player pool + market ADP | new | see below |

## Data sources to establish

The NHL pattern was: our own projection from a public stats API, real market ADP from
a third party, and a separate expert-consensus column, kept as three columns rather
than blended. Repeat that shape.

- **Stats**: `stats.nba.com` is the obvious analogue to the NHL public API. Note the
  NHL API had to be fetched with **curl, not python urllib** (the agent proxy 403s
  the latter) — expect the same constraint.
- **Market ADP**: FantasyPros' NBA pages are very likely the same trick that worked
  twice for NHL — `ecrData` embedded as JSON in the rankings page HTML, and an ADP
  page broken out per host site. Check that first.
- **Fantrax ADP**: `getAdp?sport=NBA` by analogy with the working NHL call. The NHL
  feeds needed no auth and no league ID.
- **FantasyPros My Playbook exists for NBA** (unlike NHL), so in-season league sync
  has a fallback hockey never had.
- Nine-cat NBA needs **volume-weighted rate categories** (FG%, FT%) — a 60% FG on
  three attempts is not a 60% FG on twenty. This is the classic place naive category
  rankings go wrong; see `docs/MULTISPORT_PLAN.md`.

## Suggested order, simple first

1. `nba` sport pack + a points-scoring Yahoo reference league, so the board renders.
2. NBA player pool: stats-based projection scored through the league's point values,
   plus real market ADP.
3. Ungate `isCategoryLeague()` and get 9-cat working with volume-weighted rates.
4. Roto and season-long Points.
5. Best Ball semantics, then Lock-In cadence.
6. 3rd-round reversal, then dynasty/keeper with contracts.

## Carry-over cautions from the NHL build

- **Dedupe the pool by player id**, and require position compatibility before
  accepting a name match. Both bit us: a traded player appeared twice and could be
  drafted twice in one mock, and two same-named players merged their market ranks.
- **Any profile sharing an embedded pool needs its own `poolDataRevision`**, or a
  corrected pool never reaches that profile's already-seeded cloud copy.
- `tests/validate-fantastic-data.mjs` slices `index.html` between two markers —
  nothing may be inserted between `FANTASTIC_2026_STRATEGY` and the
  `// ---------- LEAGUE PROFILES` banner.
- Expect other sessions to be editing `main` concurrently. Sync before starting and
  before pushing; prefer their mechanism over inventing a parallel one.
- A projection built on one prior season has no mean reversion and underrates
  prospects and role-changers. NHL shipped ADP-anchored guardrails for that reason.

## Open questions for the user

Asked 2026-10-01; answers arrive as the user joins leagues.

1. Which specific NBA leagues, on which platforms, and their settings (league ID,
   teams, scoring or category list, roster slots, draft type and date)?
2. Lock-In: research says it is **Sleeper's** mode (one game per player per week,
   chosen after it is played, starters only). Is that the one, or does another
   platform you'll play have its own version (Yahoo's High Score is automatic)?
3. Which Fantrax Best Ball format — roster size, how many count each period, and is
   the period daily or weekly?
4. Any salary/contract league this season, or is that hypothetical for now?

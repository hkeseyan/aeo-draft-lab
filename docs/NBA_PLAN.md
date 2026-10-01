# NBA plan — requirements and the handoff brief

Captured 2026-10-01, at the end of the NHL build. The next session starts here.
`docs/MULTISPORT_PLAN.md` holds the original cross-sport reasoning; this file is
NBA-specific and names the exact code that has to change.

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

1. Which specific NBA leagues, on which platforms, and their settings?
2. What is the Lock-In feature actually called, and what exactly does it lock?
3. Which Fantrax Best Ball format — roster size, how many count each week/period?
4. Any salary/contract league this season, or is that hypothetical for now?

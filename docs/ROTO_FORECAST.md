# Roto projected standings — October 31, 2026

## User objective

Every rotisserie league should show projected final category standings from player production and projected games, including rostered players who cover the primary lineup's missed games. Help the user plan category tradeoffs: for example, favor Paul George's rebounds/steals over Keyonte George's assists once the expected assists lead is sufficient. The question is attainable standings points from counted starts, not a sum of every bench player's full projection.

Implemented for every existing NBA and NHL roto profile, auction or snake, Yahoo or Fantrax. The pure engine uses supplied categories, ratio components, position eligibility and game budgets; it has no basketball-specific scoring. Tests also exercise a future baseball-style ERA definition. There is no MLB UI/projection pack yet; this does not claim one exists. H2H categories and points leagues do not show a roto standings table.

## Current forecast

- Source: the active draft/mock roster, or a separately loaded Yahoo current-roster snapshot. The read-only `/api/yahoo/roto-rosters` route uses the existing connected grant, includes all teams and current IL players, and never changes draft picks, keepers, ownership or lineups. Current rosters are not reconstructed from auction results. Names missing from the projection pool are listed rather than assigned invented stats. Incomplete draft rosters are visibly provisional.
- Inputs: the existing embedded/live-refreshed projection pool, its projected GP, platform eligibility, lineup size and game cap. A dated source label remains visible; fetching rosters does not refresh injuries or per-game projections. Current IL placement does not imply zero games for the rest of the season: expected availability comes from the GP projection.
- The primary lineup is a maximum-weight legal matching using current player ranks. Residual reassignment lets a flexible star move so a specialist can fit, and does not leave better players on the bench merely because a low-value player filled a slot first.
- Each primary player contributes projected GP up to a single spot's opportunity. Remaining position capacity is available to **other rostered players**, with one shared GP budget per bench player across eligible positions. No player counts twice, no imaginary free agent fills a gap, and an injured player gets no synthetic replacement production credited to his own line.
- Bench coverage is an explicit planning assumption: daily default 75%, weekly default 50% of uncovered position capacity; editable to 0%, 50%, 75% or 100%. Weekly coverage is a conservative season-level assumption, not same-day substitution. Uncovered capacity stays unfilled. NHL season opportunity defaults to 84 games (2026–27), NBA to 82; an actual league cap takes precedence. Multiple identical slots share their aggregate `count × cap` capacity.
- Counted raw stats scale from the player's per-game projection. Basketball shooting percentages pool makes/attempts. Hockey save percentage pools saves/shots; GAA uses the source pool's GP-weighted exposure because the existing embedded hockey prior has no goalie minutes. The generic ratio engine can use minutes or innings and a multiplier when those fields exist.
- Actual category standings distribute N through 1 points, with ties splitting the occupied points. Turnovers and GAA reverse direction. Every scoring category counts equally, even if the user has punted it or reduced its personal draft weight. Missing groups/zero exposure remain unknown, so an empty team cannot win TO by having zero players. Personal ranks can influence the proposed lineup; they do not change the actual roto scoring formula.

The table shows rank, roto points, counted GP, bench replacement GP, unfilled capacity and every category's projected value/points. Existing uncapped roster totals remain available under a collapsed reference section in roto leagues, distinct from the standings forecast. H2H keeps its existing reference open.

## Player and lineup scenarios

Expand “Player games and lineup scenarios,” then select any team. Each row shows projected GP, counted GP, bench-fill GP and the actual position allocation. A GP edit changes availability while retaining per-game production; it is private scenario state, not a change to the master player projection. Reset restores source assumptions.

“Bench instead / Favor / Counted games” shifts a requested block of counted starts between two rostered players. It is bounded by the favored player's unused projected GP and the outgoing player's counted games in compatible positions. It shows changes in raw categories and standings points against the same rival forecasts. If Paul George already receives all his projected games, the tool explains that no additional games fit instead of inventing more availability. Scenarios do not mutate the baseline or execute lineup transactions.

Source selection, roster snapshots, coverage and GP assumptions persist in the league's private setup and config/mock exports; they reset when switching leagues. Saved auction purchases and other draft state retain their existing persistence paths.

## Limits and next phase

This is a **full-season capacity forecast**, not a calendar simulation, an official current standings table, or banked actuals plus remaining-season production. Daily congestion, specific injury return dates, schedule timing, current position counters, weekly locked lineups and Yahoo's last-day cap overrun behavior are not modeled. The strict aggregate cap is conservative at that boundary. Coverage assumptions expose some uncertainty; they are not empirically calibrated schedule probabilities. Do not give a precise date for the Keyonte/Paul George switch from this output.

Next: combine counted actual statistics and actual games-used counters with remaining schedules and dated injury availability. Simulate legal daily/weekly lineups and return windows, then compare category gaps over time and identify feasible switch windows. This must account for the outgoing player's future starts and returning stars before spending cap capacity now. Mobile notifications remain a later opt-in delivery layer, not an automation created by this feature.

## Unrostered replacement archetypes — designed, deferred

The user may later add a bounded hypothetical block to **any** team's scenario, such as 20 C games with strong FG%, REB and BLK but weak FT%. Keep this explicit and separate from rostered replacement coverage and verified waiver availability. An archetype needs numeric per-game lines, including FGM/FGA and FTM/FTA (or goalie/baseball ratio components), eligible positions, quantity, timing and a shared usage budget. Category labels alone cannot quantify shooting impact. Derive reference lines from a visible, dated candidate population or editable numeric assumptions; do not silently turn qualitative labels into a hand-picked player or guaranteed pickup. These starts must consume cap/lineup opportunity and displace other projected starts where appropriate. No archetype editor or synthetic free-agent production ships in this version.

## Source references

- Yahoo API team/roster resources: https://sports.yahoo.com/developer/docs/
- Yahoo position usage/caps: https://help.yahoo.com/kb/fantasy-hockey/pace-positions-sln6870.html
- 2026–27 NHL 84-game season: https://www.nhl.com/news/nhl-announces-2026-27-regular-season-schedule

## Verification

`tests/roto-forecast.test.mjs` exercises legal matching, flexible positions, one shared GP budget, partial weekly replacement, unavailable players, pooled ratios, tie points, reversed categories, non-mutating legal swaps, a generic baseball ratio, NBA/NHL UI, separate Yahoo snapshots, saved assumptions and league isolation. Yahoo route fixtures cover authentication, read-only methods, team names, eligibility, IL/status metadata and timestamps. The complete project test suite remains required before publication.

# NHL mock format profiles

As of September 28, 2026, Draft Lab ships the live TRAX50 profile, its Yahoo
counterparts, and reference category formats.

## Yahoo Public Prize H2H Points — daily

- 12 teams; 2 C, 2 LW, 2 RW, 4 D, 2 G; four bench and two IR.
- Skaters: G 6, A 4, +/- 2, PPP 2, SOG 0.9, BLK 1.
- Goalies: W 5, GA -3, SV 0.6, SHO 5.
- Four acquisitions per week and a three-goalie-game minimum.
- The raw model rank rescales the component-stat projection through these values
  and uses position-specific replacement value. The displayed My Rank is temporarily
  anchored to Yahoo ADP with maximum moves of 5 picks in the top 25, 10 through
  pick 100 and 15 thereafter. Its tooltip retains the raw rank and marks capped
  disagreements. The projection column is labeled `Preseason Proj`.
- Joined leagues: 135526 and 141304, each with the completed 192-pick board.
  141304 is assigned to **Sid the Mid** from the existing slot-four / R3 Dahlin
  context; if that inference is wrong, edit only that owner assignment.

## TRAX50 Classic Draft (76) — Fantrax weekly H2H Points

- Fantrax league ID `bdd8aa7jmtjj0e84`; 12 teams; 16-round snake; 45 seconds/pick.
- 5 generic F, 3 D, 2 G; six reserves and no IR.
- Skaters: G 4, A 3, +/- 1, PPP 1, SOG 0.5, HIT 0.25.
- Goalies: W 5, GA -1, SV 0.25, SHO 5. Goalie assists inherit A 3.
- The raw model rank uses Fantrax scoring and replacement levels for the actual F/D/G
  roster buckets. C/LW/RW remain visible as source eligibility but do not create
  false scarcity or flexibility inside a generic-F league.
- Displayed My Rank uses the same draft-safety caps against live Fantrax ADP, with
  the embedded Yahoo ADP only as a clearly labeled fallback.
- Mock opponents and draft timing use the public Fantrax NHL ADP feed. If it is
  unavailable, the board says that it has fallen back to the embedded Yahoo ADP.
- The live shortlist loads a seven-day NHL schedule context. Game count is a
  bounded tiebreaker, weighted more for later and marginal picks; it does not
  rewrite intrinsic My Rank or overwhelm player quality.
- Weekly-lineup streaming confidence defaults low, and the daily Add Radar is
  hidden because intra-week lineup churn is not the management model.
- Each player locks five minutes before his team’s first game of the Monday
  scoring period. There are no trades, waiver claims are unlimited with rotating
  two-day priority, and undrafted players are FCFS free agents.

Reference: [Fantrax Classic Draft rules example](https://www.fantrax.com/newui/fantasy/leagueRulesSummary.go?leagueId=t58uewealmbjijck).

## Yahoo Public Prize Rotisserie — categories mock

- 12 teams; 2 C, 2 LW, 2 RW, 4 D, 2 G; four bench and two IR.
- Skaters: G, A, +/-, PPP, SOG and BLK.
- Goalies: W, GAA, SV% and SHO.
- The profile records Yahoo's 82-game cap by active position.
- The board's `Cat` column is standardized category value, not a translated
  Yahoo points score. Every player retains per-category z-scores, a breadth
  measure, a penalty for a severe category hole, and positional replacement
  value. The tooltip exposes the strongest categories.
- The live shortlist weights contributions toward the roster's weakest current
  categories. Goalies receive category-specific construction logic because they
  control four of the ten categories; a third goalie is penalized as an
  over-investment unless the value is exceptional.
- The H2H Categories reference uses the same engine with HIT instead of BLK and
  remains available if the user cannot enter a Roto contest.

## Yahoo Prize H2H-Cat 3175 (PRIZE 50) — joined Sep 28

- Profile `yahoo-prize-cat-3175`. 12 teams; live standard draft Mon Sep 28
  10:00pm PDT, one minute per pick; draft slot unset until Yahoo publishes it.
- C, C, LW, LW, RW, RW, D, D, D, D, G, G; four bench and two IR.
- Skaters: G, A, +/-, PPP, SOG, HIT. Goalies: W, GAA, SV%, SHO.
- Daily lineups; four acquisitions per week; three goalie appearances minimum;
  FAB waivers (two days, continuous, rolling-list tiebreak); trades until Mar 3,
  2027; six-team playoffs in weeks 25-27.
- Category columns, colours, punts, the my-team category table and the
  category-aware My Rank are described in `SPECS.md`.

Reference: [Yahoo default fantasy hockey settings](https://help.yahoo.com/kb/SLN6815.html).

## Data-source boundary

The installed FantasyPros connector currently exposes NFL and MLB only, so it
cannot supply NHL projections or league sync. NHL now fetches current raw-stat
preseason totals from NHL Fantasy Data and Hashtag Hockey, then converts them
through each active league’s scoring table. Optional Yahoo profile rows are
blended in when available, and weights are renormalized only among sources that
provide the stat. Fantrax ADP remains market timing, not a projection source. ECR remains
a visible sanity check and is not an input to hockey My Rank because the available
consensus is thin and roto-oriented.

TODO: connect an authorized Yahoo raw-projection export (or another independently
licensed current source) to `projectionSources` to complete the intended
three-source blend. Until then, the UI labels every player with its actual source
count and never disguises the offline historical CSV as a preseason projection.

## Confirm after the live leagues are selected

These reference profiles are intentionally editable mocks. Before the real draft:

1. Import the Fantrax league ID and verify that the live scoring template still
   matches, especially lineup lock timing, transaction limits and eligibility.
2. Replace fallback FantasyPros eligibility with league-scoped Fantrax eligibility
   from `getLeagueInfo.playerInfo` where available.
3. Confirm whether the Yahoo category league is Roto or H2H Categories and compare
   its returned categories, team count, roster, game cap and goalie minimum.
4. Refresh role, injury, line/power-play and goalie-workload inputs. Current
   availability is a configurable value discount/flag, never a reason to remove
   an elite player from the pool; verify each player’s return date before drafting.
5. Revisit category weights after real standings/roster context exists; deliberate
   punts should be an explicit strategy control, not an accidental model artifact.

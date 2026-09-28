# NHL mock format profiles

As of September 27, 2026, Draft Lab ships three target mock formats plus the
existing Yahoo H2H Categories fallback profile.

## Yahoo Public Prize H2H Points — daily

- 12 teams; 2 C, 2 LW, 2 RW, 4 D, 2 G; four bench and two IR.
- Skaters: G 6, A 4, +/- 2, PPP 2, SOG 0.9, BLK 1.
- Goalies: W 5, GA -3, SV 0.6, SHO 5.
- Four acquisitions per week and a three-goalie-game minimum.
- My Rank rescales the component-stat projection through these values and uses
  position-specific replacement value. The existing Yahoo daily recommendation
  behavior remains intact.

## Fantrax Classic H2H Points — weekly mock

- 12 teams; 5 generic F, 3 D, 2 G; six reserves and no IR.
- Skaters: G 4, A 3, +/- 1, PPP 1, SOG 0.5, HIT 0.25.
- Goalies: W 5, GA -1, SV 0.25, SHO 5. Goalie assists inherit A 3.
- My Rank uses Fantrax scoring and replacement levels for the actual F/D/G
  roster buckets. C/LW/RW remain visible as source eligibility but do not create
  false scarcity or flexibility inside a generic-F league.
- Mock opponents and draft timing use the public Fantrax NHL ADP feed. If it is
  unavailable, the board says that it has fallen back to the embedded Yahoo ADP.
- The live shortlist loads a seven-day NHL schedule context. Game count is a
  bounded tiebreaker, weighted more for later and marginal picks; it does not
  rewrite intrinsic My Rank or overwhelm player quality.
- Weekly-lineup streaming confidence defaults low, and the daily Add Radar is
  hidden because intra-week lineup churn is not the management model.

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

Reference: [Yahoo default fantasy hockey settings](https://help.yahoo.com/kb/SLN6815.html).

## Data-source boundary

The installed FantasyPros connector currently exposes NFL and MLB only, so it
cannot supply NHL projections or league sync. The embedded NHL pool continues to
use FantasyPros-derived Yahoo ADP/ECR captured by the project's existing refresh
workflow, NHL public-stat component projections, and the new live Fantrax ADP feed
for Fantrax market behavior. ECR remains a visible sanity check and is not an
input to hockey My Rank because the available consensus is thin and roto-oriented.

## Confirm after the live leagues are selected

These reference profiles are intentionally editable mocks. Before the real draft:

1. Import the Fantrax league ID and verify that the live scoring template still
   matches, especially lineup lock timing, transaction limits and eligibility.
2. Replace fallback FantasyPros eligibility with league-scoped Fantrax eligibility
   from `getLeagueInfo.playerInfo` where available.
3. Confirm whether the Yahoo category league is Roto or H2H Categories and compare
   its returned categories, team count, roster, game cap and goalie minimum.
4. Refresh role, injury, line/power-play and goalie-workload inputs. The current
   component projection is still primarily a prior-season-rate model and should
   not be treated as current role news.
5. Revisit category weights after real standings/roster context exists; deliberate
   punts should be an explicit strategy control, not an accidental model artifact.

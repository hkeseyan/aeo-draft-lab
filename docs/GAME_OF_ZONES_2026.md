# Game of Zones — confirmed roster and auction room, October 31, 2026

Final instructions supersede the earlier offline Murphy scenarios and full-turnover valuation. Murphy is kept at $15; Scottie Barnes is released.

## Confirmed setup

Six teams, $200 each, **18 draftable spots: 3 G / 3 F / 1 C / 3 Util (10 starters) plus eight bench**, with two IL outside those spots. The proposed extra C and bench were never added before the draft. On October 31 the user confirmed the league agreed to retain the actual Yahoo configuration. More bench without more starters would tie up useful waiver players and complicate games-cap management.

Season-long standard nine-category roto: FG%, FT%, threes, points, rebounds, assists, steals, blocks and turnovers each determine an equal standings category. The user's **valuation priorities** default to 1 except turnovers at 0.25; these do not change actual scoring. No FT punt, no H2H category-loss floor, no fantasy-point valuation. Percentages are weighted by shot attempts. Yahoo's 82-game cap is retained.

Historical costs are user-supplied 2025 Drafted Value + $1; blank values provisionally mean undrafted ($1 prior, $2 keeper). See `game-of-zones-2025-rosters.tsv`. Current roster Cost never resets a drafted salary.

## Final declarations

| Team | Keepers | Salary | Cash | Open spots | Max next bid |
|---|---:|---:|---:|---:|---:|
| Ball Don't Lie | 8 | $101 | $99 | 10 | $90 |
| It's Always Sunny in Philly | 11 | $141 | $59 | 7 | $53 |
| Aspire LLC | 8 | $152 | $48 | 10 | $39 |
| Xcho's Team | 14 | $130 | $70 | 4 | $67 |
| Jenna Jameson | 7 | $92 | $108 | 11 | $98 |
| MambaMentality | 13 | $143 | $57 | 5 | $53 |
| Total | 61 | $759 | $441 | 47 | — |

This is the pre-auction keeper baseline under the confirmed roster size, not current remaining cash. The completed auction has 108 selections: 61 keepers and 47 new purchases. See `game-of-zones-2026-auction-results.tsv` for the official ledger. The earlier 20-player scenario and its 59 open spots are superseded.

Ball Don't Lie: Jokic65, Haliburton4, Murphy15, Clingan6, Dejounte5, Rollins2, Knueppel2, McDaniels2.
Sunny releases Powell, Davis and Zion. Aych Gang and Detroit SZN are departing; their players return to the pool. All six lists are locked in the league's versioned keeper data; stale personal selections cannot add Barnes or remove Murphy.

## Existing league migration

On the next authenticated load, the existing current Game of Zones profile is matched by name and upgraded in place. Its exact ID, Yahoo link, name, actual draft date and valid six-team nomination order are preserved. No duplicate built-in profile is created when a matching import exists. A dedicated `game-of-zones-2026` profile is seeded only when no current matching profile exists.

The keeper revision is `goz-final-2026-10-27-to025-v2`. An old active pre-declaration setup is replaced once with the final baseline through the normal setup PUT, which first backs up the prior setup. Subsequent manual purchases survive reload. Saved named mocks and history remain intact. The 2025 Yahoo ID 59451 remains historical provenance, not a current league key.

Roster settings have their own revision, `goz-roster-18-2026-10-31-v1`. On the next authenticated load, an already-finalized profile receives only the corrected roster/label/cap fields and updated assumptions. It retains custom projection data, category priorities, Yahoo linkage and all setup purchases. The keeper revision is unchanged, so this correction never triggers a keeper or auction reset. Historical mock snapshots remain as saved.

## Category prices and tiers

The engine uses Draft Lab's Hashtag 50% / CBS 25% / ESPN 25% raw-stat blend (embedded snapshot with October 24 adjustments, refreshed live only when the complete Hashtag anchor is available). It scores each player's roto category contributions with TO at 0.25 and full attempt-weighted FT impact. The existing roto model includes replacement play for missed games under the daily games cap.

Personal auction weights allocate 90% above the 60-starter replacement shelf and 10% above the 108-rostered shelf, derived from the confirmed roster settings. Market weights separately blend 60% an ADP star-spending curve (decay18, shape0.8) and 40% category weights. At every sale, each layer selects the actual remaining open-slot pool and redistributes only the actual remaining cash, reserving $1 per spot. A water-filled price cap and largest-remainder rounding conserve dollars exactly.

Target bid = 90% of personal modeled dollars; stretch = 110%, subject to the user's legal max bid and $1 reserves. Estimated winning bid uses the market anchor, rival roster needs, each team's real budget/open spots, and the second-highest modeled willingness plus $1, capped by the highest willingness. These are provisional estimates, not quoted Yahoo salaries.

The entire undrafted NBA pool is searchable and selectable; rows sort by personal category value. Tiers are recomputed from that remaining pool. A tier breaks at a meaningful adjacent category gap or when the group spans too much value. The narrow first column contains only a tier label, with horizontal separators at tier breaks. Dollars and opponent perception never define tiers. Depth beyond remaining league roster capacity remains visible at $1 before limited keeper options. Large FT liabilities are visibly flagged. Cade ranks above Giannis in this no-FT-punt roto setup; the order is computed, not hardcoded.

The October 28 injury/role review supersedes the initial Kawhi-only adjustment. It combines the existing projection prior with 403 current ESPN observations and verified official injury news. Shooting and production samples are strongly regressed; sustained role changes affect minutes and opportunity more. Stance 4/5 favors current contention while allowing modest ascending-player keeper options. Long absences receive less replacement credit; pure future stashes have a generic $2 ceiling at this stance. Market ADP weights also respect availability. Dates and assumptions are visible in player tooltips. See `NBA_ROTO_REVIEW_2026-10-28.md` for inputs, sources, limits and reproduction.

The update deliberately provides tier-drop visibility without an automatic scarcity-driven bid escalator or a new complex recommender.

## Validation

October 31 additions: live priority dropdowns (0 / 0.25 / 0.5 / 0.75 / 1 / 1.5 / 2; TO default 0.25, others 1), persisted per draft; zero hard-punts a category. All category weaknesses and strengths use the same signed contribution math. Opponent estimates remain independent of personal weight changes. The auction room now includes all nine colored player-category columns and own-team plus six-team color-coded category comparisons. Raw totals and actual scoring are unchanged by personal priorities.

The official-results button uses the existing connected Yahoo account through the signed-in admin's Draft Lab session. It reads `/api/yahoo/draft-results` with this profile's current Yahoo key or resolves it from the saved profile; it does not use the historical 2025 ID. It displays actual prices and keeper flags without replacing saved mocks or sales. Missing salaries remain blank.

`npm test` covers all sports plus the dedicated `tests/game-of-zones.test.mjs`: all61 keeper joins and six budgets; no duplicate imported profile; preserved connection/date/nomination order; old-setup backup; one-time roster-only correction without changing saved sales/custom projections; TO=.25 and full FT; Cade above Giannis; full available-player list; exact remaining-dollar conservation; manual sale and reload; all47 purchases completing legally at18 players per team; tier labels and colored categories.

## In-season direction (planned)

Ball Don't Lie wants to remain competitive in REB, BLK and FG% and will favor waiver adds that improve those categories without giving away strong FT%, threes and assists. The goal is useful production per remaining counted start and a controlled finish near the cap. The user is contending, with modest keeper upside as a tiebreaker. Detailed injury, cap-pacing, category and mobile-notification requirements are captured in `NBA_PLAN.md` under "In-season roto management"; this roster correction does not implement those future modules.


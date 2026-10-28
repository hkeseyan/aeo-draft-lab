# Game of Zones — final auction room, October 27, 2026

Final instructions supersede the earlier offline Murphy scenarios and full-turnover valuation. Murphy is kept at $15; Scottie Barnes is released.

## Confirmed setup

Six teams, $200 each, 20 draftable spots: 3 G / 3 F / 2 C / 3 Util (11 starters) plus nine bench. Two IR become available after the draft. Season-long nine-category roto: FG%, FT%, threes, points, rebounds, assists, steals and blocks weight 1; turnovers weight 0.25. No FT punt, no H2H category-loss floor, no fantasy-point valuation. Percentages are weighted by shot attempts. The 82-game cap is retained from prior planning.

Historical costs are user-supplied 2025 Drafted Value + $1; blank values provisionally mean undrafted ($1 prior, $2 keeper). See `game-of-zones-2025-rosters.tsv`. Current roster Cost never resets a drafted salary.

## Final declarations

| Team | Keepers | Salary | Cash | Open spots | Max next bid |
|---|---:|---:|---:|---:|---:|
| Ball Don't Lie | 8 | $101 | $99 | 12 | $88 |
| It's Always Sunny in Philly | 11 | $141 | $59 | 9 | $51 |
| Aspire LLC | 8 | $152 | $48 | 12 | $37 |
| Xcho's Team | 14 | $130 | $70 | 6 | $65 |
| Jenna Jameson | 7 | $92 | $108 | 13 | $96 |
| MambaMentality | 13 | $143 | $57 | 7 | $51 |
| Total | 61 | $759 | $441 | 59 | — |

Ball Don't Lie: Jokic65, Haliburton4, Murphy15, Clingan6, Dejounte5, Rollins2, Knueppel2, McDaniels2.
Sunny releases Powell, Davis and Zion. Aych Gang and Detroit SZN are departing; their players return to the pool. All six lists are locked in the league's versioned keeper data; stale personal selections cannot add Barnes or remove Murphy.

## Existing league migration

On the next authenticated load, the existing current Game of Zones profile is matched by name and upgraded in place. Its exact ID, Yahoo link, name, actual draft date and valid six-team nomination order are preserved. No duplicate built-in profile is created when a matching import exists. A dedicated `game-of-zones-2026` profile is seeded only when no current matching profile exists.

The keeper revision is `goz-final-2026-10-27-to025-v2`. An old active pre-declaration setup is replaced once with the final baseline through the normal setup PUT, which first backs up the prior setup. Subsequent manual purchases survive reload. Saved named mocks and history remain intact. The 2025 Yahoo ID 59451 remains historical provenance, not a current league key.

## Category prices and tiers

The engine uses Draft Lab's Hashtag 50% / CBS 25% / ESPN 25% raw-stat blend (embedded snapshot with October 24 adjustments, refreshed live only when the complete Hashtag anchor is available). It scores each player's roto category contributions with TO at 0.25 and full attempt-weighted FT impact. The existing roto model includes replacement play for missed games under the daily games cap.

Personal auction weights allocate 90% above the 66-starter replacement shelf and 10% above the 120-rostered shelf. Market weights separately blend 60% an ADP star-spending curve (decay18, shape0.8) and 40% category weights. At every sale, each layer selects the actual remaining open-slot pool and redistributes only the actual remaining cash, reserving $1 per spot. A water-filled price cap and largest-remainder rounding conserve dollars exactly.

Target bid = 90% of personal modeled dollars; stretch = 110%, subject to the user's legal max bid and $1 reserves. Estimated winning bid uses the market anchor, rival roster needs, each team's real budget/open spots, and the second-highest modeled willingness plus $1, capped by the highest willingness. These are provisional estimates, not quoted Yahoo salaries.

The entire undrafted NBA pool is searchable and selectable; rows sort by personal category value. Tiers are recomputed from that remaining pool. A tier breaks at a meaningful adjacent category gap or when the group spans too much value. The narrow first column contains only a tier label, with horizontal separators at tier breaks. Dollars and opponent perception never define tiers. Depth beyond remaining league roster capacity remains visible at $1 before limited keeper options. Large FT liabilities are visibly flagged. Cade ranks above Giannis in this no-FT-punt roto setup; the order is computed, not hardcoded.

The October 28 injury/role review supersedes the initial Kawhi-only adjustment. It combines the existing projection prior with 403 current ESPN observations and verified official injury news. Shooting and production samples are strongly regressed; sustained role changes affect minutes and opportunity more. Stance 4/5 favors current contention while allowing modest ascending-player keeper options. Long absences receive less replacement credit; pure future stashes have a generic $2 ceiling at this stance. Market ADP weights also respect availability. Dates and assumptions are visible in player tooltips. See `NBA_ROTO_REVIEW_2026-10-28.md` for inputs, sources, limits and reproduction.

The update deliberately provides tier-drop visibility without an automatic scarcity-driven bid escalator or a new complex recommender.

## Validation

`npm test` covers all sports plus the dedicated `tests/game-of-zones.test.mjs`: all61 keeper joins and six budgets; no duplicate imported profile; preserved connection/date/nomination order; old-setup backup; TO=.25 and full FT; Cade above Giannis; full available-player list; exact remaining-dollar conservation; manual sale and reload; all remaining purchases completing legally; tier labels and FT flags.


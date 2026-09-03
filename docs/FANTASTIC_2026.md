# Fantastic Keeper Auction — 2026 final draft data

Status: **final** as of 2026-08-31. The Yahoo keeper deadline has passed and all 14 teams submitted.

Draft: **Monday, September 7, 2026 at 7:00pm PDT** (Yahoo Offline Draft).

The executable source of truth is `FANTASTIC_FINAL_TEAMS` in `public/index.html`. It preserves a stable manager key for roster joins, the current Yahoo team name for display, and the final Yahoo nomination order. `FANTASTIC_KEEPER_DATA_REVISION` versions setup/config/mock persistence so a pre-deadline saved scenario cannot replace these keepers.

## Validated league totals

- 14 teams × $200 = **$2,800** starting budget.
- **106** finalized keepers cost **$1,454**.
- **118** draftable roster spots remain with **$1,346** of auction money.
- Each team has 16 draftable roster spots. Every final keeper selection is budget-legal after reserving $1 for every open spot.
- Team keeper salaries and remaining budgets below all add to $200.

| Nom. | Yahoo team | Manager key | Keepers | Keeper salary | Remaining | Max legal opening bid |
|---:|---|---|---:|---:|---:|---:|
| 1 | Abella Danger | Savada | 8 | $92 | $108 | $101 |
| 2 | It's Always Sunny in Philly | Art M | 12 | $148 | $52 | $49 |
| 3 | Hock Tua | Avo | 11 | $187 | $13 | $9 |
| 4 | Հայաստանի ազգային հավաքական | Hakop | 2 | $26 | $174 | $161 |
| 5 | Flock Nation!! | Gugo | 8 | $161 | $39 | $32 |
| 6 | eagles's Champion Team | Khacho | 9 | $142 | $58 | $52 |
| 7 | ROTY | Gev | 6 | $104 | $96 | $87 |
| 8 | Gary's Game-Chang... | Gary | 6 | $25 | $175 | $166 |
| 9 | Glendale Football... | Aram | 9 | $46 | $154 | $148 |
| 10 | Step-Burrrrrow | Chris H | 6 | $77 | $123 | $114 |
| 11 | Stay off the WEEEED | Hovo | 8 | $111 | $89 | $82 |
| 12 | Biscuits n Gravy ... | Art S | 7 | $142 | $58 | $50 |
| 13 | SMASH BROS | Lev | 8 | $76 | $124 | $117 |
| 14 | Edward's Swag Team | Edward | 6 | $117 | $83 | $74 |

Ellipses in three team names are retained from the supplied Yahoo table because their untruncated spellings were not supplied. The Armenian, Sunny, and Eagles names were normalized from corrupted/truncated UI labels to their known full names.

## Hovo's finalized keepers

Jayden Daniels $9; Jonathon Brooks $2; Isaiah Likely $2; Blake Corum $2; Drake London $41; Tyler Warren $8; Jonathan Taylor $45; Christian Watson $2. Total: **8 players, $111**, leaving **$89 for eight spots** and an opening max bid of **$82**.

## Auction strategy carried into the app profile

`FANTASTIC_2026_STRATEGY` is deliberately separate from Market $. It captures preferred prices and roster-fit stops for Hovo's current build; it does not redefine what an opponent may pay or a player's intrinsic league value.

- Prefer a balanced four-purchase core near **$40 + $25 + $10 + $10** over **$65 + $15 + $5 + $5**. The balanced example already uses $85 and leaves only $4 for the other four slots, so live ceilings must respect minimum-slot reserves.
- Premium-lock rule: if an approved RB5–15 target reaches the preset range before the second premium player is secured, act rather than waiting for a hypothetical later bargain.
- Bijan: target $54, roster-fit max $57 (even if intrinsic value is $62+). Puka: target $51, max $54. Amon-Ra: target $46, max $49.
- Walker at $40 is an explicit buy trigger; do not pass merely hoping Achane is similarly priced or Breece is cheaper later.
- QB2 is optional and upside-only: Shough, Mendoza, or Kyler at $1–2, never more than $3. Do not spend the auction slot on Darnold/Jones/Young types who would not present a plausible pivot from a healthy Daniels.
- Bid $1 for the Ravens because they are the preferred team. Otherwise take a remaining $1 defense.

The profile also records the wider working target list and conditional health/availability ceilings. These are planning inputs, not projections or guarantees.

## Persistence behavior

On first load, all finalized keepers are assigned automatically. When the app encounters a setup, config export, or saved mock from a different keeper-data revision, it preserves independent tendencies/trades/queue data but discards stale draft picks and auction sales, then restores the final keeper snapshot. Existing cloud league profiles are refreshed only for the versioned Fantastic season-data fields; unrelated cloud-edited fields remain intact.

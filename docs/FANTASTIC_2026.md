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


# 2026 post-draft tendencies

Status: **final post-draft calibration**. Raw **live-auction** results (picks 1-118) are preserved in `docs/fantastic-2026-auction-results.tsv`; the finalized keeper snapshot remains in the app profile and the pre-draft sections above.

## Reconciliation

- Picks **1-118** were live auction purchases.
- Pick **119 (Chargers)** and everything after it were pre-draft keepers.
- **118** auction purchases + **106** keepers = **224 players**, exactly 14 teams × 16 draftable roster spots.
- Keeper salary: **$1,454**.
- Live-auction spending: **$1,255**.
- Total league spend: **$2,709** of a possible **$2,800**.
- **$91** of auction budget went unused league-wide.

The result file therefore reconciles to the league roster and budget structure.

## Draft-phase pricing pattern

Fantastic had an extreme front-loaded market:

| Auction picks | Players | Dollars spent | Average price |
|---|---:|---:|---:|
| 1-20 | 20 | $731 | $36.55 |
| 21-40 | 20 | $302 | $15.10 |
| 41-60 | 20 | $118 | $5.90 |
| 61-80 | 20 | $62 | $3.10 |
| 81-100 | 20 | $24 | $1.20 |
| 101-118 | 18 | $18 | $1.00 |

The first **40 purchases consumed $1,033 of $1,255 live-auction dollars (82.3%)**.

Compared with the 2026 Draft Lab valuation inputs, picks 1-20 cleared about **$11 above Yahoo Average Salary** and **$9.6 above FantasyPros value** on average. Picks 21-40 remained about **$12 above Yahoo Average Salary**. By picks 41-60, the average transaction was roughly in line with FantasyPros, and the market then collapsed rapidly toward $1.

### 2027 implication

Do not model Fantastic with one uniform inflation factor. Use at least:
1. a premium / early-auction inflation regime,
2. a middle-tier transition regime,
3. a late $1-5 value regime.

Live Draft Lab market values should update from observed auction sales by position and tier rather than remaining fixed at pre-draft assumptions.

## Position tendencies

Among players that cleanly matched the 2026 AEO valuation table:

| Position | Avg. auction price | Vs Yahoo Avg Salary | Vs FantasyPros |
|---|---:|---:|---:|
| WR | $15.40 | +$12.30 | +$4.50 |
| RB | $13.70 | +$4.75 | +$1.71 |
| QB | $3.07 | +$2.01 | +$1.00 |
| TE | $3.67 | +$2.43 | -$0.44 |

WR inflation was more severe than RB inflation, especially early. In picks 1-20, auctioned RBs averaged $43 and about **+$4 versus Yahoo Average Salary**, while WRs averaged $32.25 and about **+$16 versus Yahoo Average Salary**.

### 2027 implication

The dangerous overpay zone is not only scarce RB. Fantastic managers can aggressively bid up WR2/WR3-looking players when the keeper pool makes the remaining receiver inventory feel thin. Avoid assuming the middle WR tier will remain affordable.

## Stars versus balanced-build assumption

The 2026 draft challenged the pre-draft assumption that a balanced structure such as **$40 + $25 + $10 + $10** would reliably beat **$60+ + cheaper depth**.

Several true stars were close to public-market prices:
- Bijan Robinson: $64 vs Yahoo Avg $71.8.
- Puka Nacua: $61 vs Yahoo Avg $61.6.
- Ashton Jeanty: $39 vs Yahoo Avg $45.

Meanwhile many middle-tier / upside players were heavily inflated:
- Marvin Harrison Jr.: $30 vs Yahoo Avg $3.7.
- Davante Adams: $35 vs $10.2.
- Garrett Wilson: $37 vs $13.7.
- Jaylen Warren: $26 vs $4.3.
- Brian Thomas Jr.: $24 vs $2.7.
- Tetairoa McMillan: $38 vs $16.8.
- Jordyn Tyson: $23 vs $2.0.
- Carnell Tate: $24 vs $3.4.

### 2027 implication

Compare **tier premium**, not just raw dollar price. Do not automatically pass on a $55-65 superstar to "spread the money around" if the room is simultaneously turning nominal $15-25 players into $25-40 purchases.

## Rookie / upside / keeper-option premium

The matched rookies bought at auction averaged about:
- **+$8 versus Yahoo Average Salary**
- **+$5 versus FantasyPros value**

Among rookies purchased in the first 40, the premium rose to roughly:
- **+$13.6 versus Yahoo Average Salary**
- **+$8.5 versus FantasyPros**

Examples: Jeremiyah Love $33, Jadarian Price $20, Carnell Tate $24, Makai Lemon $15, Jordyn Tyson $23, De'Zhaun Stribling $13.

This is consistent with the keeper format: managers are paying not only for current-year production, but for breakout and future $+1 keeper optionality.

### 2027 implication

Draft Lab should treat keeper optionality as an explicit market component. Youth alone is not enough; the premium is strongest for youth/upside combined with a plausible role/value leap.

## Manager budget deployment

Known post-keeper auction budgets and actual live spend:

| Team | Auction budget | Live spend | Unused |
|---|---:|---:|---:|
| Gary's Game-Changing Team | $175 | $157 | $18 |
| Հայաստանի ազգային հավաքական | $174 | $174 | $0 |
| Glendale Football Club | $154 | $154 | $0 |
| SMASH BROS | $124 | $124 | $0 |
| Step-Burrrrrow | $123 | $122 | $1 |
| Abella Danger | $108 | $99 | $9 |
| ROTY | $96 | $94 | $2 |
| Stay off the WEEEED | $89 | $86 | $3 |
| Edward's Swag Team | $83 | $83 | $0 |
| Biscuits n Gravy Pt 2 | $58 | $57 | $1 |
| eagles's Champion Team | $58 | $20 | $38 |
| It's Always Sunny in Philly | $52 | $33 | $19 |
| Flock Nation!! | $39 | $39 | $0 |
| Hock Tua | $13 | $13 | $0 |

The richest wallets controlled the opening market. Gary, Hakop, Glendale, and SMASH accounted for 9 of the first 14 auction purchases.

### 2027 implication

Opponent budget is predictive, but not all available dollars should be assumed to enter the market. Maintain manager-specific **budget-utilization tendencies**. In particular, 2026 shows some managers willing to leave substantial money unused.

## Cheap-position tendency

Live-auction spending by position:
- WR: **$640**
- RB: **$513**
- QB: **$54**
- TE: **$35**
- DEF: **$13**

RB + WR accounted for roughly **92%** of live-auction dollars.

The 1-QB replacement market remained cheap: 15 QBs cost $54 total, with a $2 median. TE and defense also became inexpensive late.

### 2027 implication

For a team already holding an elite QB, avoid meaningful QB2 spend unless the player offers unusually strong upside / keeper optionality. Likewise, TE2 and DEF generally should not consume scarce auction capital unless a specific value falls.

## Worked example: Hovo / Achane

Hovo bought De'Von Achane for **$49 at pick 9**. The static pre-draft target had been materially lower, but before Achane was nominated the room had already established:
- Love $33
- Bijan $64
- Saquon $50
- Jeanty $39
- Amon-Ra $60
- Puka $61
- Walker $47
- DJ Moore $29

By pick 9, the observed premium market had invalidated the original static ceiling.

### Product implication

Draft Lab should calculate a live market adjustment after enough relevant auction sales:
- by position,
- by projected/ECR tier,
- by keeper-option profile,
- and by remaining opponent budgets / roster needs.

A target can retain its intrinsic or roster-fit value, while **Market $** should move dynamically with actual room behavior.

## Data-cleaning notes

The 2026 raw result file should use stable manager/team identifiers for longitudinal analysis. Display names changed or were truncated:
- `ROTY` was previously tracked under a different display name.
- `Glendale Football Club` differs from earlier `Glendale Football Team`.
- Several Yahoo UI labels were truncated in pre-draft tables.

Approximately 18 live-auction entries did not cleanly join to the then-current valuation table. Seven were defenses. Other examples included Patrick Mahomes, KC Concepcion Jr., Ja'Kobi Lane, Najee Harris, Greg Dulcich, Chris Bell, Kaelon Black, Brian Robinson, Caleb Douglas, Cyrus Allen, and Oronde Gadsden. Some are aliases / name-normalization issues rather than missing-player issues.

Before using 2026 as a calibration dataset for 2027:
1. normalize aliases and suffixes,
2. join by stable player IDs where available,
3. join teams by stable Yahoo manager/team IDs rather than display names,
4. preserve both the original raw label and normalized canonical label.

## 2027 draft-prep checklist derived from 2026

1. Load finalized keepers and exact opponent remaining budgets.
2. Estimate not only league-wide inflation but each manager's likely budget deployment.
3. Flag scarce early WR and RB tiers separately.
4. Apply keeper-option / rookie upside premium to Market $, not necessarily to Hovo's Target $.
5. Watch the first 5-10 sales for regime calibration.
6. Update Market $ live from observed sales; do not leave pre-draft prices static.
7. Avoid automatically preferring a balanced construction if the middle tier is more inflated than true stars.
8. Once the first 40-ish premium/middle purchases pass, become willing to wait: 2026 showed a sharp transition into $1-5 values.
9. Continue separating intrinsic value, Hovo Target $, roster-fit max, and observed Market $.

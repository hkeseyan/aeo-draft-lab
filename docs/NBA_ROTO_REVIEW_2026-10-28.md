# Game of Zones projection review — October 28, 2026

The review uses the existing Hashtag/CBS/ESPN projection prior, refreshed public ESPN season-to-date observations retrieved October 28 (403 players), and the latest verified official injury report, October 27 at 8pm ET. This is an injury/role overlay, not a claim that all three providers published fresh complete projections. The original keeper revision is unchanged; saved auction purchases remain valid.

## Current production and keeper upside

Competitiveness is 4 of 5: rebuild, develop, balanced, contend, all-in. Most value comes from this year's roto contributions. Young players with sustained expanding roles receive a small keeper option, capped at $3 incremental value. A future-only stash is limited to 1% of the $200 budget at this stance; this generic rule produces a $2 ceiling without setting a named player's price. Age alone does not promote an ordinary rookie over a productive veteran.

Daily roto replacement coverage remains complete above 60% of the games cap and declines proportionally below it. Occasional absences can be covered from the bench. An almost entirely lost season cannot claim a full replacement season as its own value. This is a roster-occupancy approximation, not a guarantee that every manager fills every game.

## Evidence and shrinkage

Observed minutes receive at most 25% weight, with a two-minute limit absent a separately documented role change. Per-minute production receives at most 10% observed weight and a 10% rate-change limit. Shooting uses 400 prior FG attempts and 200 prior FT attempts, with percentage changes capped at two and 2.5 percentage points. Attempts and assists under documented role changes use at most 33% observed weight and a 25% rate-change limit; this represents opportunity rather than a sudden shooting-talent upgrade. One hot game cannot rewrite the established prior.

Long-term OKC absences support sustained minutes for Mitchell and McCain. Bailey's opportunity partly reverses after Jackson's absence. Lendeborg's starting opportunity receives a partial-season increase; his own questionable foot status remains included. Black's boost lasts only a short share of the season given Suggs' reevaluation. All role durations and recovery allowances are modeling assumptions, not confirmed medical return dates.

Williams' 3% and Wallace's 15% remaining-season availability are conservative scenarios under uncertain surgical recovery. Other known absences use reevaluation windows plus modest ramp-up allowances. An ESPN OUT flag without a separately verified duration receives only two expected missed games, rather than inventing a long-term prognosis. The raw status remains visible. Played games are removed from remaining-season projections.

Tiers use only category contribution, with all eight positive categories at full weight and TO at 0.25. Neither opponent perception, keeper bonuses nor auction dollars define tier boundaries. The first column shows a short tier label and horizontal rules mark breaks. Target, projected winning and stretch prices remain distinct; market prices also account for availability and real remaining rival budgets.

## Sources and reproduction

- ESPN observations: `data/nba-observations-2026-10-28.json`, reproduced with `node scripts/refresh-nba-observations.mjs`.
- Official injury report: https://ak-static.cms.nba.com/referee/injury/Injury-Report_2026-10-27_08_00PM.pdf
- OKC surgery news: https://www.nba.com/news/thunders-jalen-williams-has-fractured-leg-dislocated-ankle-and-will-need-surgery
- Utah reevaluation: https://www.nba.com/news/jaren-jackson-jr-torn-mcl-october-2026
- Suggs official release: https://www.nba.com/magic/news/jalen-suggs-injury-update-mild-right-knee-bone-bruise-release-20261026
- Lendeborg role/game news: https://www.nba.com/player/1642865/yaxel-lendeborg

Inputs and individual explanations are retained in `NBA_ROTO_REVIEW`; hover a player for its dated review. Reapplying the review is idempotent. Other leagues keep their existing projection and replacement behavior.

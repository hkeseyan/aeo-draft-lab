# Guillotine FAAB operating model

## Purpose

Waiver Lab turns the weekly Yahoo league state into a reviewable recommendation set. It is deliberately split into four prices:

- **Suggested** — what this roster should bid, given the lineup upgrade, remaining budget, risk posture and manager overrides.
- **Competitive market** — the strongest non-winning bid in comparable historical stacks; this is the price cluster before one manager overreacts.
- **Projected win** — the model's expected clearing price after blending the current player tier with the comparable history and competitor balances, when Yahoo supplies them.
- **Outlier win** — the observed/aggressive winner band. This is shown because a projected winner can still lose to one unusually aggressive manager.
- **Stretch max** — the roster-specific ceiling. It is not a prediction and should never exceed a manager-entered maximum.

The split is important. The early 2026 results were bimodal: Kyren Williams and Puka Nacua had deep, competitive bid stacks, while Braelon Allen, Matthew Golden, Brock Bowers and Parker Washington were won by bids far above the next manager. Treating every winner as the new normal would systematically overbid.

## Preserved calibration dataset

The code contains 22 baseline observations from the 18-team and 12-team Off With Their Heads leagues through September 30, 2026. Each observation retains date/week, league size, player, position/tier, winning bid, every supplied lower offer, winning manager, completeness and notes.

Known user transactions in the 18-team league are preserved in those stacks:

- Week 2: Emeka Egbuka $57, Tucker Kraft $21, Caleb Douglas $0.
- Week 3: Jameson Williams $17 (incomplete stack).
- Week 4: Saquon Barkley $203 and Jaylen Wright $3.

The model prefers same-player history when an eliminated roster returns a previously auctioned player, then same position+tier at the same league size, then same position. Twelve-team observations do not silently price an 18-team pool. New results can be appended per league from Waiver Lab using CSV; they are stored in KV and included in later reports without a deploy.

## Decision rules learned from the weekly reviews

1. Endgame players can justify large bids because they solve a lineup position for many weeks, but the bid remains capped by injury/role uncertainty and remaining FAAB. Availability does not equal obligation to buy.
2. Immediate survival matters. A player who does not enter the optimal lineup this week usually receives a lower roster-value bid even if the market is expected to be aggressive.
3. Roster need is directional, not generic. No meaningful QB spend is recommended behind Josh Allen; an elite TE has reduced utility when Tyler Warren and Tucker Kraft already occupy TE/flex paths; lost RB production materially raises RB value.
4. IR is an occupied roster slot, not a free acquisition slot. The app preserves Yahoo's roster slot and never assumes an IR player supplies a drop path.
5. Drops are classified before the waiver pool: dead, replaceable, conditional or protected. Lineup displacement is not automatically the roster cut.
6. Conditional claim ladders matter. A primary bid can drop the first expendable player, with a lower backup bid tied to a second drop. The manager can set both drops and the secondary multiplier per candidate.
7. User judgment is authoritative. Per-player suggested bids, maximums, pass decisions and notes override the model. Market estimates remain visible so the tradeoff is explicit.
8. Remaining competitor FAAB changes market reachability. When Yahoo returns balances, Waiver Lab uses the competitor median to adjust market pressure and caps the win estimate at one dollar above the largest available competitor balance.

## Tuesday data flow

Cloudflare runs source refreshes every four hours and at both UTC hours that can represent Tuesday 1:00am Pacific. The Worker checks `America/Los_Angeles`, so daylight-saving changes still produce one Tuesday report.

At the Tuesday run:

1. Refresh the configured Yahoo league and FantasyPros enrichment.
2. Match the logged-in Yahoo team and read its roster, roster slots and FAAB balance.
3. Page through Yahoo waivers and free agents, then read recent drop/commissioner transactions.
4. Detect the latest batch of at least three players dropped by the same source team within two hours; place that eliminated roster first, followed by the rest of the current Yahoo-available pool.
5. Enrich matching roster rows with FantasyPros projections/ECR/schedule context when available.
6. Create a report only when the available pool is current and authoritative from Yahoo. A stale saved pool can be displayed as a fallback, but it cannot generate a new scheduled report.
7. Record the outcome as `created`, `skipped` or `failed`. A skipped/failed 1:00am attempt can retry on the four-hour trigger through 5:00am Pacific.

## One-time configuration

For each guillotine league:

1. The league profile must contain the Yahoo league ID/key and the user's Yahoo team name. Both Off With Their Heads profiles already exist.
2. Connect Yahoo once in **Leagues → Connect Yahoo**. One Yahoo grant covers both leagues.
3. In **Waiver Lab → League data sources**, leave Yahoo enabled. FantasyPros is optional enrichment; paste that league's MyPlaybook URL/key and save it if desired.
4. Click **Refresh now** once and confirm the source line says `roster: yahoo`, `available pool: yahoo`, and shows the expected Yahoo FAAB balance.
5. Enter the correct week and teams alive, set the manager's drop classifications/weekly notes, and save inputs. Leave **run Tuesdays 1am Pacific** checked.
6. Optional email requires the `RESEND_API_KEY` and `FAAB_REPORT_FROM` Worker secrets plus a destination email in Waiver Lab.

The app never submits a Yahoo claim. It prepares a claim ladder/ticket for manual review and submission Tuesday night.

## Weekly manager workflow

On Tuesday morning, open Waiver Lab and review the last source timestamp and Tuesday-run outcome. Add any context Yahoo/FantasyPros cannot infer in **Manager notes**. Use the player override CSV for exact ceilings, passes and drop ladders. After waivers clear, paste the new bid results into **Bid-history calibration** so the next report learns from the full winning and losing stack.

If Yahoo says connected but the roster/pool is not current, use **Refresh now**. If the league cannot be matched, confirm the league profile's Yahoo ID/key and `meOwner` value. If the Yahoo grant fails, disconnect/reconnect once; do not replace Yahoo availability with FantasyPros roster data.

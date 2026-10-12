# Waiver decisions: reusable reasoning

Captured from the manager's October 11, 2026 NHL discussion. These rules extend the football framework across sports. Named players are calibration examples; their names are not the general policy.

## Two values, not one ranking

**Intrinsic value** means expected contribution over the relevant hold horizon, independent of this particular roster. Evaluate past production, current production, role/deployment, playing time, power-play opportunities, health and expected recovery. Ownership is a discovery/market signal and a useful anomaly check; it can lag news and cannot alone establish value. A slow start requires checking whether the underlying role changed, rather than assuming either a breakout or a collapse.

**Team holding value** means the loss this particular team would suffer if the player left. It includes intrinsic value, actual usable starts, positional/role scarcity, alternative acquisition options, future roster changes, contingent coverage and transaction cost. Do not collapse it into an overall ROS rank. A modest player can be essential to this team while a better overall player is crowded out.

The eventual comparison should explain these components separately. Numerical weights are not established yet; the 0.1 backup credit and early-game tie preference are provisional scheduling inputs, not a complete player-value model.

## Begin with roster needs

1. Identify healthy active players and their complete league-specific eligibility. Keep injured reserve stashes separate from active lineup capacity.
2. Identify unmet starting positions and scarce roles. Use matching across all eligible slots rather than independent position counts that double-count a multi-eligible player.
3. Fit each day's lineup to calculate guaranteed usable starts and crowded-day backup availability.
4. Evaluate the whole proposed roster after a cut/add. An incoming player must actually replace the coverage or role being lost. A forward cannot resolve a defense shortage merely because its point projection is higher.
5. Preserve explicit manager holds while the value model is incomplete; expose editable choices and their reasons.

**Defense example:** if a league starts four D and this roster has three healthy D, the third D has high team holding value even if otherwise streamable. Most of its scheduled games should be usable. Dropping a surplus forward or goalie may cost less. An add/drop that exchanges D for another D can resolve the shortage differently from one that exchanges D for F. A D is not permanently protected just because it is a D: the conclusion changes when positional coverage or available replacements change.

## Goalie reliability is a role, not just a count

Two healthy goalies do not necessarily provide two reliable workloads. Distinguish reliable volume, shared/uncertain workload, low-volume backups and injured future volume. Include anticipated starts and the league's goalie minimum; team scheduled games alone are not goalie starts.

**Manager-supplied current scenario for 135526:** Gibson is the reliable volume option; Skinner is the second healthy option but more replaceable; Hellebuyck is a future source of volume when available again. Gibson's extra holding value comes from being the only reliable healthy volume source, not his name. This is manager context, not independently verified current injury/deployment data.

**Change condition:** reassess when Hellebuyck actually returns with a usable workload, another reliable volume goalie becomes available, or Gibson's own workload changes. Do not blindly keep a conditional goalie hold forever. Conversely, do not infer reliable volume from simply having two G on the roster.

## Acquisition intent precedes schedule sorting

- **Long-term priority:** an established, healthy asset worth acquiring regardless of immediate schedule. Zero immediate usable games does not invalidate it. It still requires a defensible cut/roster path. Crosby is the manager's example, not an assumption that his slow start must reverse.
- **Schedule streamer:** roughly comparable replacement-level options, chosen for actual lineup fit, acquisition timing, points/category value and the shared add budget.
- **Longer-term watch:** potentially worth holding, with a useful schedule acting as the trigger for acquisition. Neither a mandatory add nor interchangeable churn.
- **Temporary injury / IR watch:** no immediate streaming contribution, but potentially valuable after recovery. Display injury/recovery evidence, its freshness and the roster/IR path. Do not mix this into healthy streamer rankings.
- **Current-season exclusion:** no plausible contribution inside the planning/holding horizon, including a confirmed season-ending absence.

## General availability rule

| Evidence | Current scheduling assumption | Acquisition treatment |
| --- | --- | --- |
| Q / day-to-day without definite absence | Assume playing; show uncertainty | May remain in healthy candidates |
| Definite OUT / IR | No immediate starts while absent | Separate longer-term/IR review; do not assume season-ending |
| Confirmed out for remainder of season | No current-season contribution | Exclude current-season pickups regardless of ownership, old rank or reputation |
| Suspected long absence without confirmation | Unresolved news | Flag for verification; do not invent a season-ending diagnosis |

Shesterkin's NHL.com report is one evidence record supplying the confirmed season-out inputs. The exclusion rule itself must apply to any player with those inputs, including a player absent from the reviewed-context list. Preserve source, publication/check date, confidence, affected season and any superseding update. The evidence scope must expire; a season-out report must not silently apply next season. Keeper/dynasty horizons may justify a future-season stash and need their own valuation layer; current-season exclusion is not a universal permanent player ban.

## Healthy elite-player guard

Kucherov illustrates a valuation sanity check: a healthy elite asset should not become a generic streaming cut because one week's lineup is crowded. A proposed cut should trigger an explanation/review failure unless there is a verified material change or a specifically justified extraordinary replacement. Ownership, sustained production and intact deployment support that assessment together; none is an unconditional single-field protection threshold.

## Timing, optionality and add budget

Keep guaranteed starts separate from backup games. Crowded-day games retain contingency value if another starter is unavailable or space opens. The current provisional 0.1 credit does not turn them into guaranteed fractional games or projected points.

Prefer early usable games when comparable streamers share a limited slot: an owned Monday game can be used before moving to the next player. Carry the first/last usable dates and next acquisition cutoff. One slot and two slots draw from the same four-add budget. Initial acquisitions, pending commitments and later replacements all consume that budget; retaining an already-owned early streamer does not. A full optimizer must consider the jointly feasible sequence, not add up independent candidate alternatives.

## Counterfactual acceptance cases

- Same player and schedule, different positional depth: team holding value changes; intrinsic value does not automatically change.
- Third D with four D slots versus sixth D with four slots: the first has higher coverage importance.
- One reliable healthy volume goalie plus an uncertain goalie versus two reliable healthy volume goalies: the sole reliable option receives more holding value.
- Injured volume goalie returns with a confirmed workload: reevaluate the interim goalie hold.
- Healthy elite player has zero starts on one crowded week: do not recommend a routine streaming cut.
- Any newly confirmed season-out player, even 99% owned and highly ranked: exclude current-season pickups.
- Short-term IR absence with strong longer-term value: show as injury/IR watch with evidence rather than an immediate streamer or automatic exclusion.
- Comparable streamers with equal guaranteed starts: backup coverage and earlier access to the next claim can distinguish them.

## Implementation boundary

Implemented today: roster matching, usable/backup games, editable hold/drop preferences, scheduling/budget context, acquisition intent, host injury tags, reviewed evidence and a player-independent confirmed-season-out exclusion. The named 135526 preferences are temporary manager labels, not learned universal protections.

Still to model: automatic intrinsic/team-specific values, deployment/production news ingestion, reliable-volume probabilities, dynamic positional/role hold thresholds, recovery scenarios and joint weekly claim optimization. Retain the manager's reasoning as structured labels and change conditions so those future models can be tested against the counterfactuals above.

# NHL/NBA Waiver Lab

1. Select the league, then open **Waiver Lab**. On Sunday use **Next week**; midweek use **Remaining week**.
2. Refresh/paste the roster and available-player pool. Classify roster drop_class: protected, conditional, replaceable or dead. Optional lineup_priority is higher-first; otherwise points leagues use per-game points, category leagues fall back to ROS rank.
3. Set **Adds active from** to the first scoring date after the host’s waiver processing and lineup cutoff. Candidate available_from can override it. Put the submission deadline in Decision context. Enter **Adds remaining** for this period.
4. Run the report. Review **Daily lineup coverage** and **Drop candidates** before candidate rankings. A three-game player benched for all three has zero usable games. Positional openings matter; an open D slot does not fit a winger.
5. Compare net starts after each roster swap. In points formats, compare net points too. Keep long-term holds protected and use conditional for players who require a meaningful ROS upgrade.
6. For FAAB, enter a manual bid before creating a draft ticket. Resolve timing, expected goalie starts, category needs and other warnings before submitting manually in the host app. Rerun after a successful acquisition; alternatives can share a drop or lineup opening.

Weekly leagues select one lineup for the whole window. Use Next week before its lock; this version does not infer the currently locked lineup or support Lock-In/Best Ball.

Goalie start_dates are semicolon-separated YYYY-MM-DD dates, not all team games. OUT players remain excluded across the window until the status is updated; this version does not forecast their return.

The optional Sunday report checkbox runs at 9am Pacific using freshly synced roster/availability. It is off by default. Acquisition timing/limits must be reviewed for the new week; a Sunday report does not submit bids. Midweek recalculation is on demand.

If a schedule provider fails, paste date,team CSV. Include both teams for each game and every date in the selected range. On off days, include a date row with team blank. Example:

```csv
date,team
2026-10-12,BOS
2026-10-12,COL
2026-10-13,
```

This example covers only two dates; use a matching custom two-day range or extend the CSV to the full selected window. NBA live CDN availability still needs deployment verification; its normalization is covered by fixtures.

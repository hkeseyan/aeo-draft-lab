# NFL Player Ranker MVP

The Player Ranker is a fast, personal NFL preference-capture surface. It asks a
single binary question — “who would you rather have?” — and turns the saved event
ledger into one personal board. It intentionally starts as a ranking signal, not a
claim that one number can answer every fantasy question.

## Mobile UI

The **Tools → Player Ranker** page is shown for NFL only. Tools Overview can explicitly open it from another sport by switching to NFL. Two large cards present a matchup;
tapping a card, choosing its button, or making a horizontal swipe on the card records
that player as the preferred choice. A skip immediately deals another matchup. The
top of the board favors players with fewer comparisons, then selects a nearby rating
when possible so early choices establish useful local ordering quickly.

Before choosing, the user selects context that travels with the event:

| Field | MVP values |
| --- | --- |
| `decision` | `overall`, `trade`, `start_sit`, `waiver`, `draft` |
| `timeframe` | `season`, `week`, `long_term` |
| `teamWindow` | `neutral`, `competing`, `rebuilding` |
| `format` | `generic`, `redraft`, `dynasty`, `keeper`, `guillotine`, `best_ball` |
| `superflex` | `on`, `off` |
| `tePremium` | `on`, `off` |
| `matchupType` | `same_position`, `cross_position` |

The first board combines all events into one Elo-style ordering. Context is retained
rather than applied to that combined score, so a later trade-only or rebuilding-
dynasty view can be calculated from the original choices without a data migration.

The compact **Ranking settings** panel remembers a Superflex and TE Premium choice
on the device (Superflex defaults to the active league on first use) and captures
both values with every new answer. It does not retroactively reinterpret existing
choices. NFL matchup generation targets 65% same-position pairs, using the remaining
cross-position pairs to calibrate the overall board; every event records which type
was shown so this can be measured and tuned later.

## Data and API

Events are private to the signed-in user. They are stored in the existing `MOCKS` KV
namespace under `rankings:<sport>`; the application’s existing user-scoping keeps a
non-admin user’s ledger separate. With accounts disabled, the owner ledger is used,
matching the rest of the single-user deployment.

```json
{
  "version": 1,
  "sport": "nfl",
  "events": [
    {
      "id": "m4j8s-2a14fb71",
      "createdAt": 1780945259000,
      "sport": "nfl",
      "winner": { "id": "104", "name": "Example Player", "pos": "RB", "team": "SEA" },
      "loser": { "id": "88", "name": "Other Player", "pos": "WR", "team": "CHI" },
      "context": {
        "decision": "trade",
        "timeframe": "long_term",
        "teamWindow": "rebuilding",
        "format": "dynasty",
        "superflex": "on",
        "tePremium": "off",
        "matchupType": "same_position"
      }
    }
  ]
}
```

- `GET /api/rankings?sport=nfl` returns the event ledger.
- `POST /api/rankings?sport=nfl` accepts `winner`, `loser`, and `context`, and
  appends one validated event.
- `DELETE /api/rankings/:eventId?sport=nfl` removes a single event, which powers
  **Undo last**.

Each ledger is capped at 2,000 events in this KV MVP. That is ample for one user but
also makes the next storage boundary explicit: multi-user/community aggregation
should store immutable events in a queryable database, retain `userId` separately,
and compute public boards from eligible, de-duplicated events rather than exposing
private ledgers.

## Ranking method and future work

The client replays events chronologically with a 1,500 starting rating and a 28-point
Elo K-factor. The derived board stores no mutable rating, so the algorithm can be
re-run or versioned later. A player’s recorded position/team snapshot gives historical
events readable identity even if the live player feed changes.

This is deliberately separate from the valuation model’s Player Assessment → League
External Fair/Market Value → Team Utility → Decision Score flow. Pairwise preferences
are an additional, explainable input to that future system; they do not overwrite
fair value, market value, or roster-specific recommendations.

## Next data snapshot phase

Injury/IR status, expected-return confidence, season average, and recent-form trend
need a timestamped, source-attributed NFL player-context snapshot before they appear
on ranker cards. The current player pool does not contain a trustworthy live feed for
those fields, so this is intentionally separate from the ranking UI rather than
displaying stale or invented data. Recent player notes remain their own planned
feature; the snapshot will supply structured injury/performance facts without
duplicating those notes. Once the snapshot exists, its revision and source timestamps
will travel with the later valuation and matchup-priority work.


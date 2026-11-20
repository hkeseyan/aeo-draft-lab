# Read-only Yahoo trade analysis

The Worker reads Yahoo fantasy data with its existing owner connection. It checks that Yahoo identifies exactly one team owned by the connected login in the requested league. The ChatGPT OAuth client is separate from Yahoo. Google sign-in uses OpenID, email address and profile for Draft Lab identity. It requests no Gmail mailbox permission.

| Interface | Purpose |
| --- | --- |
| `list_yahoo_leagues` | Discover configured Yahoo league slugs |
| `get_pending_trades` | Read the connected team's live pending incoming and outgoing offers |
| `get_yahoo_draft_results` | Read Yahoo's official finalized auction results for a league and season |
| `get_yahoo_trade_analysis` | Read pending offers with settings, standings, rosters, keeper costs and optional valuations or hypothetical counters |
| `GET /api/yahoo/auction-draft-results` | Authenticated web equivalent of the auction-results tool |
| `GET /api/yahoo/trade-analysis` | Authenticated web equivalent for pending-offer analysis |

The current season comes from Yahoo settings. A historical request uses a verified league key in the profile's `yahooLeagueKeysBySeason` map, then checks Yahoo's returned season. The existing `GET /api/yahoo/draft-results` remains available for other draft formats.

The original tools require `trades:read`. The two context tools also require `trade-context:read`. A legacy token may still list tools and read trades. A context call with that token requests additional consent. All Yahoo fantasy data requests are GETs. The connector has no Yahoo transaction-write tools. A Yahoo provider error or unrecognizable pending-trades payload yields an error instead of an empty offer list.

## Draft prices and keeper rules

Each completed draft is recorded as a content-addressed snapshot keyed by Yahoo league key and season. Each row identifies the player by Yahoo player ID in that season. The ledger stores the official salary and keeper flag separately from current team ownership. Retries match the same snapshot, and any changed provider response creates a different snapshot. Prices are derived from the official draft. Trades, drops and waiver bids leave those prices unchanged.

| League | Annual increase | Undrafted QB first keeper | Other undrafted first keeper | Budget and open-slot reserve |
| --- | ---: | ---: | ---: | --- |
| AEOK Auction | $1 | $6 | $2 | $200, reserve $1 per unfilled draftable slot |
| Fantastic Keeper Auction | $1 | $2 | $2 | $200, reserve $1 per unfilled draftable slot |

A player qualifies for the undrafted fallback only when absent from a verified, complete draft. A drafted player whose price is missing has an unknown cost. Analysis gives both the base draft season and next keeper season. Salary savings compare the actual salaries of the two trade packages. Budget savings also reflect the change in minimum bids reserved for open slots. Package scenarios assume all included players are kept and exclude the rest of the team's keeper commitments. The official draft read works for other Yahoo auction leagues, with keeper math limited to leagues with configured rules.

## Trade decision inputs

- Use Yahoo scoring, positions, standings and both current rosters when assessing the trade. The roster impact reports roster sizes, positional depth, and cuts or openings when a known roster cap applies. Yahoo injury status is included when available. Position counts may overlap when a player qualifies at multiple positions.
- Redraft emphasizes rest-of-season and playoffs. Auction keepers also use next-season salary and independently projected auction surplus. Dynasty can use multi-year projections. A draft-round keeper league should get its own keeper policy before applying salary math.
- Team strategy can be stored in `tradeAnalysis.teamStrategies` using the Yahoo team key, league season, dated intent, source and optional playoff odds. The standings supply the record. They do not imply manager intent or a playoff probability.
- Optional projections use Yahoo player keys with a source and observation date, such as league-scored FantasyPros rest-of-season projections or independently estimated auction dollars. Projection totals are acquired-player production before lineup optimization. Projected keeper surplus compares each independently projected auction value against its official next-season salary.
- Optional hypothetical counters specify a partner and both sides by player key. Analysis checks both Yahoo rosters and returns these candidates separately from actual pending offers. A dated strategy, alternative candidates, current injuries and time remaining to respond can all affect which deal to pursue. The tool does not predict when a manager will respond.

## KeepTradeCut and package valuation

KeepTradeCut keeps separate one-QB and superflex values. Its crowdsourced values reflect relative user choices, and its trade-sourced values also use observed dynasty transactions. Its calculator accounts for roster spots, elite assets and package composition. It describes factors and how the shown adjustment is derived without publishing a full reproducible formula. Treat it as evidence of perceived dynasty market price, and match the settings and observation date. Salary, keeper eligibility and league-specific scoring still determine the value to this roster.

KeepTradeCut prohibits automated collection in its terms. Draft Lab accepts a sourced market input supplied through an authorized channel, with no KeepTradeCut scraping or bulk feed. A format-matched FantasyPros source can corroborate dynasty or rest-of-season evaluations. Auction context can draw on Yahoo salary values and independent auction projections available to the user. Rankings, player points, and keeper auction dollars remain in their respective units.

Draft Lab uses a transparent package heuristic. Sort players by comparable market value from a single source. Subtract a user-supplied replacement value from the players who consume occupied roster slots, floor each contribution at zero, and divide the marginal value of the player in rank `i` by `i`, starting at 1. Apply the calculation for each manager using their own open slots. The result expresses estimated attractiveness on that source's value scale. When applying dynasty values to a salary keeper or redraft league, output the source as a proxy and leave the counterparty market judgment unset.

| Example with full rosters and 20 replacement value | Raw total | Adjusted total |
| --- | ---: | ---: |
| One player at 100 | 100 | 80 |
| Two players at 72 and 45 | 117 | 64.5 |
| Five players at 30 | 150 | About 22.8 |

Revisit the rank discount and replacement floor against real, authorized completed trades before interpreting the adjusted number as a prediction of manager behavior.

Sources

- [KeepTradeCut FAQ and package adjustments](https://keeptradecut.com/frequently-asked-questions)
- [KeepTradeCut calculator settings](https://keeptradecut.com/trade-calculator)
- [KeepTradeCut terms](https://keeptradecut.com/terms-and-conditions)
- [FantasyPros dynasty superflex rankings](https://www.fantasypros.com/nfl/fantasy-football-rankings/dynasty-superflex.php)
- [FantasyPros PPR rest-of-season rankings](https://www.fantasypros.com/nfl/fantasy-football-rankings/ros-ppr-overall.php)
- [OpenAI MCP authentication](https://developers.openai.com/plugins/build/auth)

## Connection verification

The production smoke test checks OAuth discovery and the unauthenticated 401 boundary. To verify the plugin end to end, use its installed ChatGPT connection, complete the Draft Lab consent flow, call `list_yahoo_leagues`, and then call `get_pending_trades` with `aeok-auction`. Compare the resulting Yahoo league key, owned team, offer directions and timestamp with an authenticated Trade Lab read. Check the MCP server management page's exact CIMD client ID and callback URI if authorization never reaches consent. If the plugin is visible but neither listed tool is available, verify the installed release's MCP connection metadata and activation in the current ChatGPT session. A successful package upload, public metadata probe or fixture test does not verify the authenticated ChatGPT connection.

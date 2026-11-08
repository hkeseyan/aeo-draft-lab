# Management areas and pages — November 7, 2026

The app has two navigation levels. The first selects an area of work; the second contains only that area's pages. The league and sport selectors remain shared context.

| Area | Pages |
| --- | --- |
| In-season | Waiver Lab; Trade Lab (planned); Roto standings (roto leagues); H2H matchups (planned, head-to-head formats); Add Radar (eligible daily NHL points leagues) |
| Draft | Draft Room; Teams & Keepers; Draft Trades; Mocks; Strategy Lab |
| Commissioner | Leagues; Members & dues; Data |
| Tools | Overview; Player Ranker (NFL) |

Trade Lab and H2H matchup projections have clearly marked planned pages. No new valuation or matchup engine is implied by those navigation entries. Draft Trades continues editing keeper rights, draft rosters and draft-pick ownership; it does not submit in-season player trades. Player Ranker retains its existing private NFL preference ledger; community aggregation and additional sports are separate future work. Tools Overview can open the existing NFL ranker from another sport, explicitly switching to NFL.

## In-season roto

The single existing `rotoForecastCard` now lives in `view-roto`, outside Draft Room. Its current-roster snapshot, saved GP/coverage assumptions, player allocation and comparison controls retain their existing persistence and calculations. The page also exposes lineup category priorities using the same saved weights as the draft's category controls. Actual scoring still counts every category. The uncapped draft-roster reference stays in Draft Room.

## State and routing

- Fresh signed-in navigation starts in In-season: Roto standings for roto leagues, otherwise Waiver Lab. Draft remains explicitly available through its own area. Guest/signed-out mode retains Draft Room only.
- The browser remembers the selected area and the last page within each area for each league. Switching leagues keeps the current area and page where applicable. When a page does not apply to the new league/sport, restore that league's remembered page or a valid default **within the same area**.
- Routes include the league and page, for example `?league=game-of-zones-2026#inseason/roto`, `#draft/mocks` or `#tools/ranker`. A direct route takes precedence over saved navigation. Back/forward traverses page changes. Loading a saved draft mock still opens Draft → Draft Room.
- Navigation state is browser preference only. It does not rewrite league settings, keeper declarations, draft picks, auction sales, ranker events or saved roto scenarios. Existing module loaders run when their page opens; league data retains its existing initialization path.
- Commissioner pages retain the existing admin restriction. Unavailable pages are hidden from the contextual navigation; the router rejects them too. Guest DOM removes the private In-season, Commissioner and Tools sections, including saved roto data. Server authorization is unchanged.

## Verification

`tests/navigation.test.mjs` covers the hierarchy, standalone roto location, lineup priorities, draft/forecast state preservation, area/page memory, cross-league fallbacks, NFL ranker access, direct links, reloads, browser-history routing, non-admin access and guest isolation. Existing smoke checks treat sport-specific page availability separately from whether its area is currently selected. The full project suite remains required before publication.

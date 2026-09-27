# Points draft day: Public Points League 1

As of September 26, 2026. This is a manual snapshot, not a live injury or Yahoo feed.

## Board and roster

Yahoo Prize H2H-Pts 135526 is twelve teams, fourth slot. All 192 final picks are seeded. Our completed roster, in pick order: Kucherov, Matthews, Gauthier, Seider, Hellebuyck, Forsberg, Erik Karlsson, Alex Tuch, Shea Theodore, Mark Stone, John Gibson, Mattias Ekholm, Josh Doan, Steven Stamkos, Darcy Kuemper, Filip Gustavsson. The room took premium D and G aggressively. The actual draft shifted from a forward-heavy early response to four D and four G, including an injured late goalie stash.

Hellebuyck was suspended for failing to report to camp after requesting a trade. No return date is known. Count him as a rostered upside option, not an active goalie and not an IR stash. An active goalie is a priority at the next viable value point. Do not stack an injured goalie as the only other G without a working starter.

## One IR stash, conditional on Yahoo designation

The Public Prize points format has two IR slots, but Yahoo IR eligibility requires the league's designation. An injury report or an `O` tag alone does not guarantee it. Check the player card before relying on the extra spot. Prefer a skater for this particular roster:

There is no separate IR panel in the draft room. When two personal picks remain, the recommender can elevate one undrafted stash candidate into its normal top six, clearly marking Yahoo IR eligibility as pending. It does not reserve a second stash once one is rostered. An injured star whose normal expected value supports an earlier pick remains eligible for an earlier recommendation; this late boost is for candidates otherwise buried in the market list. Recheck designations and recovery reports on Monday, September 28, before roster moves.

1. **Brad Marchand:** Panthers coach expects him out through October. Good stash if Yahoo grants IR and his price is cheap enough.
2. **Kevin Fiala:** the Kings hope for a November 1 return, described as a best-case path in their September 18 camp report. Only six games in the first three weeks limits the missed-game cost, but reassess progress before drafting.
3. **Filip Gustavsson:** Wild say he will miss the season start after hip surgery; Wallstedt and Pickard begin in net. Goalie upside, but clashes with the Hellebuyck exposure.
4. **Frederik Andersen:** Edmonton expects him out initially and described a three-goalie rotation on return. Lower priority here.

DFO's [player news](https://www.dailyfaceoff.com/hockey-player-news) and [injury report](https://www.dailyfaceoff.com/hockey-player-news/injuries/193) are useful for daily checks; confirm opening lines and goalie starts on draft day. These pages are external references, not an integrated feed. Do not infer a stable power-play role from one preseason line.

## Pool audit and model changes

All 192 reported picks resolve in the league pool. Barkov had been missing from the September 17 NHL pool and was added as a minimal league-specific row in the previous update; its observed pick number is **not Yahoo ADP**, and the zero projection is a missing datum rather than a forecast. Gavin McKenna, Quinton Byfield, Gabriel Landeskog, and Ivar Stenberg also needed board-only placeholder rows; JJ Peterka maps to the pool's John-Jason Peterka. These placeholders have no modeled projection or authentic ADP. The underlying 400-row rankings bury Marchand (255), Fiala (259), and Gustavsson (151), and the default table displays only 220 rows. Search handles initials and accents, searches the entire pool, and explains when a player was already drafted.

The existing profile retains its internal ID `public-points-league-1` so saved setups continue to load, and now records Yahoo league ID 135526 and the final team names. A versioned snapshot merges picks 78–192 into a saved 77-pick board without replacing any slot the user had entered.

Two separate 12-team Yahoo Public Prize reference profiles now capture the published default categories and Roto settings. H2H Categories uses skater G/A/+/-/PPP/SOG/HIT and goalie W/GAA/SV%/SHO. Roto changes HIT to BLK and uses the 82-game position cap. Both retain 2C/2LW/2RW/4D/2G, four bench, and two IR slots. Their category rankings, projections, Add Radar, and live recommendations are intentionally pending a format-specific model, so the points model is not presented as advice in those profiles.

Yahoo draft board positions and clubs differed from the source pool for several early players. A dated override maps observed eligibility and seven team changes; this is not a wholesale refresh. Live recommendations count Hellebuyck as unavailable for starting-G coverage, and My Rank discounts the five dated health-watch players. These weights are a heuristic for missed time; no current Yahoo ADP or current-season statistical projection has been imported. A later Yahoo API grant should replace the stale market field and verify roster/IR statuses directly. A successful OAuth grant currently still returns 403 for the Fantasy resource, so the manual draft board remains authoritative.

Sources: [Yahoo default league settings](https://help.yahoo.com/kb/SLN6815.html), [Yahoo IR rules](https://help.yahoo.com/kb/SLN22673.html), [Hellebuyck](https://www.nhl.com/news/connor-hellebuyck-does-not-report-to-camp-suspended-by-winnipeg-jets), [Marchand](https://www.nhl.com/panthers/news/maurice-provides-injury-updates-on-marchand-and-gadjovich), [Gustavsson](https://www.nhl.com/wild/news/wild-training-camp-preview-091726), [Fiala](https://www.nhl.com/kings/news/insider-day-1-training-camp-notes-ken-holland-injuries-fiala-dumoulin-zuccarello), [Andersen](https://www.nhl.com/news/edmonton-oilers-season-preview-2026-27).

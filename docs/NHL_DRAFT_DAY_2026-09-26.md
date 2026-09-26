# Points draft day: Public Points League 1

As of September 26, 2026. This is a manual snapshot, not a live injury or Yahoo feed.

## Board and roster

Twelve teams, fourth slot. Picks 1–77 are seeded. Our seven picks are Kucherov (4), Matthews (21), Gauthier (28), Seider (45), Hellebuyck (52), Forsberg (69), and Erik Karlsson (76). Next overall pick: 78. The room took premium D and G aggressively, so a forward-heavy response is rational if replacement D is streamable; the four-D starting lineup still creates a weekly coverage cost. The recommender should compare marginal starter value against the next turn, not enforce 2F/2D by round four.

Hellebuyck was suspended for failing to report to camp after requesting a trade. No return date is known. Count him as a rostered upside option, not an active goalie and not an IR stash. An active goalie is a priority at the next viable value point. Do not stack an injured goalie as the only other G without a working starter.

## One IR stash, conditional on Yahoo designation

The Public Prize points format has two IR slots, but Yahoo IR eligibility requires the league's designation. An injury report or an `O` tag alone does not guarantee it. Check the player card before relying on the extra spot. Prefer a skater for this particular roster:

1. **Brad Marchand:** Panthers coach expects him out through October. Good stash if Yahoo grants IR and his price is cheap enough.
2. **Kevin Fiala:** the Kings hope for a November 1 return, described as a best-case path in their September 18 camp report. Only six games in the first three weeks limits the missed-game cost, but reassess progress before drafting.
3. **Filip Gustavsson:** Wild say he will miss the season start after hip surgery; Wallstedt and Pickard begin in net. Goalie upside, but clashes with the Hellebuyck exposure.
4. **Frederik Andersen:** Edmonton expects him out initially and described a three-goalie rotation on return. Lower priority here.

DFO's [player news](https://www.dailyfaceoff.com/hockey-player-news) and [injury report](https://www.dailyfaceoff.com/hockey-player-news/injuries/193) are useful for daily checks; confirm opening lines and goalie starts on draft day. These pages are external references, not an integrated feed. Do not infer a stable power-play role from one preseason line.

## Pool audit and model changes

All 77 reported picks resolve in the league pool. Barkov had been missing from the September 17 NHL pool and was added as a minimal league-specific row in the previous update; its observed pick number is **not Yahoo ADP**, and the zero projection is a missing datum rather than a forecast. The underlying 400-row rankings also bury Marchand (255), Fiala (259), and Gustavsson (151), and the default table displays only 220 rows. Search now handles initials and accents, searches the entire pool, and explains when a player was already drafted.

Yahoo draft board positions and clubs differed from the source pool for several early players. A dated override maps observed eligibility and seven team changes; this is not a wholesale refresh. Live recommendations count Hellebuyck as unavailable for starting-G coverage, and My Rank discounts the five dated health-watch players. These weights are a heuristic for missed time; no current Yahoo ADP or current-season statistical projection has been imported. A later Yahoo API grant should replace the stale market field and verify roster/IR statuses directly. A successful OAuth grant currently still returns 403 for the Fantasy resource, so the manual draft board remains authoritative.

Sources: [Yahoo default league settings](https://help.yahoo.com/kb/SLN6815.html), [Yahoo IR rules](https://help.yahoo.com/kb/SLN22673.html), [Hellebuyck](https://www.nhl.com/news/connor-hellebuyck-does-not-report-to-camp-suspended-by-winnipeg-jets), [Marchand](https://www.nhl.com/panthers/news/maurice-provides-injury-updates-on-marchand-and-gadjovich), [Gustavsson](https://www.nhl.com/wild/news/wild-training-camp-preview-091726), [Fiala](https://www.nhl.com/kings/news/insider-day-1-training-camp-notes-ken-holland-injuries-fiala-dumoulin-zuccarello), [Andersen](https://www.nhl.com/news/edmonton-oilers-season-preview-2026-27).

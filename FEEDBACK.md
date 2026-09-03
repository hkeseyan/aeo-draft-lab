# Feedback inbox

A running log of feedback and improvement ideas captured while actually using
the app — meant to survive switching between devices and sessions (Claude
Cowork, Claude Code, etc.) without relying on memory.

**Claude: read this file at the start of every session.** Anything marked 🆕
is unaddressed. Triage it — fix now if small and unambiguous, ask the user if
it's ambiguous or larger, or note why it's deferred. When an item is acted
on, update its status in place here (don't delete the line — it's the
history) and fold the resulting behavior into `SPECS.md`.

Status legend: 🆕 new · 🔧 in progress · ✅ done (see SPECS.md) · ⛔ won't do

## Entries

- 🔧 2026-08-27 — **Separate auction market-price model from Hovo target-bid model; add external price sources.** User likes the auction-price MVP but wants opponent behavior grounded in market data: Yahoo's league-setting-aware generated salary-cap values/average cost if retrievable should be the primary “draft-against” source, supplemented by trusted external auction-value/average-cost sources. Hovo's own target bids should be a separate valuation layer blending multiple sources with the project's custom Volume/Efficiency/Profile, scarcity, keeper inflation, IR, and league-specific adjustments. Do not force one dollar column to serve both rival simulation and Hovo decision support. Research current data-source availability and design the schema so source weights can be changed later without rewriting auction mechanics.

- ✅ 2026-08-27 — **Auction keeper profiles + mock-draft MVP, with corrected league facts.** Global keeper/dynasty/redraft definitions and IR-as-value-overlay remain as captured. Fantastic is Yahoo 835427, **14 teams / 16 draftable + 2 IR**, $200, full-PPR/6pt-pass-TD, deadline **Sun 2026-08-30 12:00am PDT**; 2026 costs come from the completed `Fantastic Football Auction Keeper League Tracker 2026` Sheet. AEOK Auction is Yahoo 868349, **12 teams / 18 draftable + 2 IR**, full-PPR Superflex, Live Salary Cap draft **Tue 2026-09-08 9:00pm PDT**, keeper deadline **2026-09-08 12:00am PDT**; its Sheet's manager tabs are authoritative because they apply the special undrafted-QB $6 rule. Added both built-in league profiles plus an auction Draft Room MVP: editable projected/actual keepers for every team, keeper budget legality, team money-left/max-bid views, manual sale recording, undo/reset, simulated market sales, and auction mock persistence. Provisional market-dollar estimates are scenario aids only until the custom rankings/projections/auction-value engine is calibrated; keeper decisions are intentionally not finalized from these values alone.

<!-- Newest first. One line per item: date, status, short description. -->

- 🆕 2026-09-03 — **Yahoo Fantasy Sports API now requires a manual approval
  application — the developer-console checkbox no longer does anything.**
  Ground truth after actually reproducing the failure with a *fresh* grant
  (ruling out stale-token and admin-session theories, both wrong guesses on
  the way here): connecting via `discord-bot` (an old YDN app with "Fantasy
  Sports · Read" checked) still gets a **403** from Yahoo's API itself —
  `{"error":{"description":"This application is not authorized to perform
  this action."}}` — even seconds after a brand-new OAuth grant. The user's
  other, newer app (`Kyos Fantasy Manager`, created ~2 weeks ago) doesn't
  offer a Fantasy Sports permission option **at all** anymore, only OpenID +
  an unrelated "TW Auction" permission. Confirmed via
  `sports.yahoo.com/developer/access/`: Yahoo now gates Fantasy Sports API
  access behind a **manual application reviewed by Yahoo's Fantasy Sports
  team** — read-only, explicitly allows "personal or single league use" as a
  stated use case, wants the existing app's Client ID if you have a YDN
  account. The old self-serve checkbox is a UI vestige from before this
  change; checking it and reconnecting does nothing. **Blocked on Yahoo's
  manual review — nothing further to fix in our code or Cloudflare config
  until that's approved.** `/api/yahoo/status`'s `client_id_hint` and
  `/api/yahoo/disconnect` (shipped this session) remain useful for verifying
  which app is connected once/if approval comes through.

- 🔧 2026-09-02 — **Yahoo: Fantasy Sports · Read was already ticked, so the
  permission wasn't the problem.** My earlier diagnosis was wrong — the user's
  screenshot of the `discord-bot` app shows the box already checked. The real
  mechanism: **a refresh token cannot gain a scope it was never granted**, and
  `getYahooAccessToken()` refreshes the stored grant indefinitely. Worse,
  clicking Connect again doesn't necessarily fix it — Yahoo skips the consent
  screen for an app you've already approved and reissues on the *same* grant.
  So if the grant was ever made before that permission existed (or against a
  different app), it stays permission-less forever. Two candidates remain and
  they're now distinguishable: (a) the client id in Cloudflare belongs to a
  different Yahoo app than the one being edited — plausible, the app is named
  `discord-bot`; (b) the grant predates the permission. Shipped the tooling to
  tell them apart rather than guessing again: `/api/yahoo/status` now returns
  `client_id_hint` (ends + length of the client id this Worker actually holds,
  public by construction and admin-gated anyway) and `connected_at`; a new
  `POST /api/yahoo/disconnect` drops the stored grant; the Leagues tab gains
  **Check status** and **Disconnect** buttons and explains the revoke-then-
  reconnect sequence. Still 🔧 until the user reports which cause it was.

- ✅ 2026-09-02 — **Player headshots + rookie flag.** Both picked as the next
  build. Sourced from Sleeper's free public player list
  (`api.sleeper.app/v1/players/nfl`), matched to `players-2026.csv` by
  normalized name — 235/235 non-DST players matched cleanly, no manual
  crosswalk. Two new optional CSV columns, `sleeper_id` and `rookie`
  (`years_exp===0` at pull time — so 2025 rookies like Jeanty/McMillan/Egbuka
  correctly do *not* show RK for the 2026 season, only true 2026 rookies like
  Jeremiyah Love and Fernando Mendoza do). Headshots hotlink
  `sleepercdn.com/content/nfl/players/<id>.jpg` — no storage, no image
  pipeline — with `onerror` hiding a broken/missing image instead of showing a
  broken-image icon. Both now appear in Best Available, the auction pool
  table, drafted picks on the snake board, and My Picks. `poolToCSV()` and the
  Data-tab CSV format docs updated to round-trip both new columns.

- ✅ 2026-09-02 — **Where do I connect Yahoo? Getting a 401
  `oauth_problem="additional_authorization_required"`.** The button is in the
  **Leagues** tab → *Connect Yahoo (in progress)* → **Connect Yahoo account**
  (admin only). That error is *not* a missing or expired token — it means the
  Yahoo app itself was never granted fantasy access. Fix it in the Yahoo
  Developer console: open the app, tick **Fantasy Sports → Read** under API
  Permissions, save, then Connect again to re-consent. The app now says this in
  the Leagues tab, and `/api/yahoo/leagues` detects that specific Yahoo error
  and returns the remedy instead of a bare 502.
- ✅ 2026-09-02 — **Auction values need to fall off sooner and reach $1-3
  faster.** *"No one is going to be bidding $9 on Cam Ward or $4 on Jacoby
  Brissett in a single starting QB league. Brian Robinson Jr, Kamara, Pacheco
  should be in the $2 range already, with Emmett Johnson, Jaydon Blue, Emmanuel
  Wilson tier being definitely no more than $1."* Root cause was structural, not
  a knob: the price curve read overall ADP only, so the 25th quarterback in a
  1-QB league still looked like the ~150th player overall and drew real money.
  Prices are now **value over replacement** — each position's shelf is derived
  from the league's own starters/flex/superflex/bench, and everything at or past
  it is worth the minimum bid. Fantastic now prices Cam Ward, Brissett, Tre'
  Harris and Colby Parkinson at $1, Emmett Johnson/Jaydon Blue at $2, and its
  $4-9 band shrank from 46 players to 21. Two caveats to check: Brian Robinson
  Jr. and Kamara land at $5 rather than $2, and **AEOK is superflex**, where
  Cam Ward at $10 is arguably right — the $9 you saw was probably Fantastic on
  production running the *generic* curve, because its fitted settings never
  reached the cloud profile (see next entry).
- ✅ 2026-09-02 — **Fitted auction settings never reached production.** Cloud
  league profiles are deliberately never overwritten by code defaults, so
  `auctionDecay`/`auctionShape`/`auctionMaxPriceShare`/`keeperHorizon`/
  `keeperRules` — all added after both auction profiles were first seeded into
  KV — were silently absent live, and production was pricing off the generic
  defaults. Same class of bug as `leagueKeepers` on 2026-08-31. The one-time
  backfill is now field-by-field over a list rather than special-cased to one
  field, and still only fills a value the cloud copy doesn't have.
- ✅ 2026-09-02 — **Three-tier green/yellow/red positional counts.** The
  "how many left" strip in the auction room now reads *top tier / still
  rosterable / past replacement*. Boundaries are detected, never fixed dollars,
  per the explicit ask (*"if I say $30+ is green, then I don't want to leave a
  guy out that is $29"*): **red** is everyone past the position's replacement
  level given who's already rostered, **green** is everyone above the single
  biggest price cliff in the top half of what remains, **yellow** is the middle.
  It re-reads the live pool, so green narrows on its own — Fantastic currently
  shows RB green as exactly the Bijan/Barkley/Jeanty/Achane/Walker/Jacobs/Love/
  Hall tier, and QB green as Dak alone.

- 🆕 2026-09-02 — **Auction valuation: pause and rethink the approach.** User
  pushed back on the % -of-budget ceilings: *"Just because I threw out a guess
  that Bijan won't go for more than $72, doesn't mean either I was right or
  that that's the market value. The market value can be something like $64 but
  someone spends $71 on him, that's fine. I also am not sure we should be
  setting these as a % from these arbitrary figures."* Wants to brainstorm the
  approach together step by step another time rather than keep tuning it now.
  **Important distinction he's drawing: market value ≠ what somebody actually
  pays.** A model that predicts $64 isn't wrong because one manager pays $71 —
  the sale price includes bidding-war noise the *value* shouldn't. Current
  fitted curves and ceilings stay in place for now but should be treated as
  provisional, not as the definitive method. Do not tune further unprompted.
- 🆕 2026-09-02 — **Replicate Yahoo's Projected $ for our leagues.** User wants
  Yahoo's projected auction cost as a column, because those numbers are on
  screen in front of leaguemates while they bid and therefore anchor real
  behavior. Explicitly: *find it and confirm it first, don't build the column
  yet* — "so we don't have too many numbers that don't mean anything yet."
  *Researched 2026-09-02.* Yahoo's projected/average auction cost lives in the
  Fantasy Sports API under `players;out=draft_analysis`
  (`average_auction_cost`), and there is **no public path to it**: the API
  returns 401 without OAuth, the league player-list page is a login wall that
  renders zero player names client-side, and the public editorial API carries
  only NFL schedule metadata, no fantasy values. **The good news:**
  `YAHOO_CLIENT_ID` is already configured in production — `/auth/yahoo/start`
  returns 403 (the admin-only check) rather than 500 (missing credential), and
  the credential check runs first. The OAuth scaffolding in `worker.js`
  (`/auth/yahoo/start`, `/auth/yahoo/callback`, token refresh, KV storage) is
  already built. So the remaining step is the admin completing the Yahoo
  consent flow once, then adding a `draft_analysis` fetch. Blocked on the user
  connecting the account; not built pending their confirmation.
- ✅ 2026-09-02 — **Auction room layout pass.** Roster panel moved above Team
  budgets; roster now has an owner dropdown and lays players into starting
  slots best-ECR-first, matching the snake room (with a header showing money
  left, max bid and slots filled). Pool table drops ADP for ECR — Market $ is
  already the auction's version of draft position, so ADP was a duplicate
  signal in a column. Added a position filter and search to the pool plus a
  per-position remaining-count strip (the auction equivalent of the snake
  room's scarcity cues), so "how many RBs are left and how hard should I bid"
  is answerable at a glance. Team budgets drops the Keep $ / Draft $ split —
  mid-auction only money left and max bid change a decision.
- ✅ 2026-09-02 — **Edward's 165/35 split confirmed** by the user (its totals
  row was missing from the source paste, so it had been computed).

- ✅ 2026-09-01 — **AEOK keepers loaded; auction curves fitted per league.**
  User asked whether the new pricing was live in AEOK with correct values,
  flagged "$43 is too low" there, said Bijan at $80 in Fantastic was still high
  (~$72 felt right) and asked whether that was driven by remaining budget, then
  supplied AEOK's finalized keepers.
  *AEOK keepers*: 93 across 12 teams, parsed and loaded as `leagueKeepers`.
  Team names were Yahoo names again, mapped by roster content — all 12
  unambiguous, zero cost mismatches, and 11 of 12 reconciled against their
  stated salary/remaining totals. **Team 12 ("Edward's Victorious Team") had no
  totals row in the paste**; its $165 committed / $35 left is computed from the
  keeper list. `ownerSlot` set to the sheet's nomination order.
  *The "$43 too low" was a real bug, not a judgment call.* AEOK was using
  Fantastic's fitted decay (50), which put AEOK's top player at exactly $43
  while that league's own history says $58. Two causes: (a) the auction settings
  weren't in `applyLeagueProfile()`'s allow-list, so per-league values silently
  fell back to defaults — same class of bug as `leagueKeepers` last time; and
  (b) a one-parameter exponential can't fit both leagues. Fitting revealed they
  are genuinely different markets: Fantastic max $64/median $6/25% at $1-2,
  AEOK max $58/median $8/**11%** at $1-2 — AEOK is far flatter, since superflex
  with 18 roster spots spreads money over more rosterable players.
  *Fix*: added a second shape parameter (stretched exponential,
  `exp(-(rank/decay)^shape)`), fitted per league against their own realized
  prices — Fantastic decay 42/shape 0.90 (reproduces $66/$6/26.3%), AEOK decay
  34/shape 0.70 ($53/$7/9.3%). Per-league ceilings too: Fantastic 36% ($72,
  above its realized 32% to allow for the thinned elite tier), AEOK 32% ($64).
  *The hard clip had to become a soft one*: clipping put four different players
  at exactly $72, destroying the ordering that a bid decision actually turns on.
  Replaced with a monotonic soft knee — and it must be applied **once**, since
  iterating (squash → redistribute → squash) collapsed seven players onto $58.
  *Answer to "is it the remaining budget?"* **No — the opposite.** Fantastic has
  $1346 over 118 slots = $11.40/slot, slightly *less* than a full auction's
  $12.50. The premium is scarcity: five of the top ten (Chase, Jefferson,
  Gibbs, McCaffrey, Lamb) are kept, so whoever is best available absorbs a much
  larger share of the curve. AEOK shows the same mechanic in reverse — $8.10 per
  slot, well under normal, so its prices sit below the ceiling unaided.
  Result: Bijan $119 → $80 → **$71**; AEOK top $43 → **$51**.

- 🆕 2026-08-31 — **Carry the auction valuation work over to BASKETBALL auctions
  in ~1-2 months.** User: the lessons here will translate — not identically, but
  with a lot in common — and wants to leverage this work rather than restart
  after football drafts wrap in a week. What should transfer, in priority order:
  (1) **calibrate against the league's own realized prices** rather than any
  synthetic curve — the single highest-value idea here, and it needs nothing but
  a history of past winning bids; (2) **cap by observed share of budget**
  (football league's realized ceiling was 32%, capped at 40%); (3) **price
  retention as a break-even max bid** over a keeper horizon
  (`keeperBreakEvenBid`), which is what stops you overpaying a young player past
  the point he stays keepable; (4) **infer trajectory from age** via positional
  aging curves. What must be re-derived for basketball: `AGE_PEAK` (NBA curves
  differ — later peaks, longer primes), the position multipliers in
  `auctionWeight()`, the decay constant, roster/format shape, and whether
  categories-vs-points scoring changes positional scarcity. All of those are
  already per-league settings rather than hardcoded, so a basketball league
  should be a profile plus a recalibration, not a rewrite. See `SPECS.md` →
  "Auction valuation".

- ✅ 2026-08-31 — **Auction prices were absurd and Target $ = Market $.** User
  flagged $119 Bijan / $91 Jeanty / $54 Jacobs in a $200 league, and that the
  two dollar columns were identical.
  *Two independent causes, both fixed.* **(1) Identical columns**: neither
  layer had any source data — `auctionPriceSourceStatus()` returned false for
  both, so `weightedDollar()` fell through to the same fallback curve twice.
  **(2) Absurd prices**: the fallback decayed as `exp(-adp/35)`, far too
  concentrated (top 10 available players claimed 26% of all remaining money),
  with no ceiling, then got rescaled onto a keeper-thinned pool.
  *Fix, following the user's own manual method:* calibrated the curve against
  the **106 real keeper prices from this exact league** (real winning bids +
  $1/yr escalation — max $64, median $6, 25.5% at $1-2). Fitting the decay
  constant gives 50, which reproduces max $59 / median $6 / 25.9% at $1-2 in a
  full auction. Added `auctionMaxPriceShare` (0.40 of budget) with
  redistribution so totals still balance. Result: Bijan $119→$80, Jeanty
  $91→$67, Jacobs $54→$48, Nacua $104→$73.
  *Target $ now models keeper economics* via `keeperBreakEvenBid()` — the
  highest price at which a player still returns value once next year's cost
  (price + $1) is counted, over a 3-year horizon, with a cliff that kills the
  premium once he stops being keepable. That's the Egbuka case ($23 paid, $24
  keeper price, no longer worth keeping) expressed as math. Trajectory comes
  from an explicit `trajectory` column, else inferred from `age` via positional
  aging curves, else neutral.
  *Investigated but rejected as sources:* FantasyPros auction values (403 —
  paywalled; `type=auction` just returns ordinary PPR rankings, not dollars)
  and VBD off projections (`proj` only 16% populated for this pool).
  **Confirmed available and not yet wired in:** Sleeper's free player API
  (`api.sleeper.app/v1/players/nfl`, no auth) carries `age` and `years_exp` for
  all 12,225 players — Love 21, Jeanty 22, Bijan 24, Jacobs 28, Henry 32. With
  ages attached the model already separates them correctly (Jeanty +$12 keeper
  premium, Love +$6, Jacobs -$2). **Until that enrichment lands, Target $ and
  Market $ still read identically**, since trajectory defaults to neutral with
  no age data. Offered to the user as the next step.

- ✅ 2026-08-31 — **Fantastic auction keepers loaded as league data.** User
  pasted the Yahoo keeper sheet (14 teams, nomination order, keepers, salaries,
  remaining budget) and asked to add it to the league data so kept players drop
  out of the auction pool and team budgets drive bidding.
  *Done. Parsed 106 keepers across all 14 teams; every team's salary total and
  remaining budget reconciled against the sheet with zero arithmetic errors.
  The paste used **Yahoo team names**, not profile owner names, so the mapping
  was derived from roster content rather than guessed — all 14 resolved
  unambiguously (every keeper matched its owner, next-best owner scored 0), and
  all 106 costs matched the costs already stored in `ROSTERS_RAW_FANTASTIC`'s
  4th field, so no cost data was duplicated. Stored as a new `leagueKeepers`
  array of `"Owner|Player"` on the league profile — league facts, not personal
  modeling, so every signed-in leaguemate sees the same board (per-user
  `assigned` still stacks on top for what-ifs). `rebuildKeepers()` folds both
  together with dedupe; `applyLeagueProfile()` now carries `leagueKeepers`
  through (it builds LEAGUE from an allow-list, which silently dropped it at
  first). No new auction logic was needed — `resetDraft()` already marks
  keepers drafted for auction leagues and `auctionTeamState()` already derives
  spend/remaining/max-bid from KEEPERS. Verified: pool 316 → 210, all 14
  budgets match the sheet exactly (Avo $187/$13, Savada $92/$108, Hovo
  $111/$89, …), and 40 simulated sales produced zero overspends. Teams &
  Keepers shows the 106 as checked + disabled with a LOCKED chip so a locked
  keeper can't be toggled into a board that doesn't match reality.*
  **Note:** nomination order from the sheet is recorded in comments but not yet
  wired to `ownerSlot` — the profile's slot order is different, and changing it
  would move existing auction data. Flagged for the user.

- ✅ 2026-08-31 — **Nomination order confirmed correct; kept players not
  showing on their teams after reload.** User confirmed the pasted nomination
  order should drive `ownerSlot`. Separately, reloading the app after the
  keeper commit above still didn't show kept players on their teams.
  *Both done. **Root cause of the missing keepers**: `fantastic-auction` was
  seeded into KV by an earlier session (PR #13), and `fetchCloudLeagues()`
  deliberately never overwrites an already-seeded cloud profile with newer
  code defaults — a real edit in the Leagues tab must always win. That's
  correct in general, but it meant the `leagueKeepers` field added in the
  previous entry could never reach the live KV copy on its own: the code's
  in-repo default had it, the deployed cloud profile didn't, and cloud always
  wins. Added a one-time backfill in `fetchCloudLeagues()`: for any built-in
  league whose cloud copy has an empty/missing `leagueKeepers` but whose code
  default has a real one, merge it in and PUT the merged profile back —
  narrowly scoped to that one field so it can never clobber a real edit.
  **`ownerSlot` now follows nomination order** (Savada 1 → Edward 14) instead
  of the arbitrary order it had; safe to reslot since no auction sales have
  been recorded yet. Verified end-to-end with a mock KV that reproduces the
  exact stale-cloud-profile scenario: the backfill PUT fires once, all 106
  keepers appear on the right teams via the Roster dropdown, all 14 budgets
  still reconcile against the sheet, and AEO-Keepers/other leagues are
  untouched.*

- ✅ 2026-08-30 — **Leagues tab has no way to set rounds.** User tried to
  update AEO-Keepers to 15 rounds after the earlier code-side fix and found no
  field for it — correctly: `collectLeagueForm()` never read a rounds input,
  it just carried forward whatever the profile already had. Suggested adding
  either a rounds field or a bench-spots field.
  *Done — added "Rounds" as a direct field (next to Teams), not a separate
  bench-spots field: bench isn't a stored quantity in this app's model, it's
  "whatever's left after starters are filled" (see `slotRosterPlayers`), so a
  bench field would just need converting back to rounds anyway. Wired into
  load/new/collect. You can now set AEO-Keepers to 15 in the Leagues tab
  yourself — the rounds:15 default in the code is only the fallback for a
  from-scratch KV store, not something you need code changes to override.*

- ✅ 2026-08-29 — **AEO-Keepers is 15 rounds, not 16.** A league settings error
  was corrected — one fewer bench spot, so the draft runs 15 rounds.
  *Done — `rounds:15` on the AEO-Keepers profile (10 starters + 5 bench = 180
  picks). This edits the hardcoded fallback; the live profile in KV needs the
  same change via the Leagues tab or it'll keep drafting 16.*
- 🆕 2026-08-29 — **Evaluate FantasyPros Real-Time ADP** as the ADP source
  (https://www.fantasypros.com/nfl/real-time-adp/). User expects it to capture
  recent news the standard ADP lags on — Jeanty and Jacobs going later, Nabers
  higher, Jordyn Tyson lower, Jeremiyah Love slightly. Explicitly does NOT want
  hand-tuned per-player adjustments; wants the formula to capture it. If the
  source checks out, switch to 2/3 real-time + 1/3 Yahoo; if there are doubts,
  discuss (possibly 1/3 each).
  *Investigated 2026-08-29 — **recommending against the straight swap**, decision
  pending. The page is client-rendered, backed by `api.fantasypros.com/v2/json/
  nfl/{year}/consensus-rankings?type=adp&scoring=HALF` with an API key published
  in their own page bundle. It is NOT a broad consensus — it's exactly three
  sources (ESPN 79, Yahoo 236, Sleeper 4350), and **ESPN currently returns 0
  players**, so today it's just Yahoo + Sleeper averaged. That makes 2/3
  real-time + 1/3 Yahoo resolve to ~2/3 Yahoo + 1/3 Sleeper: it drops FP's own
  broader consensus entirely and heavily double-counts Yahoo. It also doesn't
  deliver what was wanted — for the five players named, movement was negligible
  (Jeanty +1.6, Jacobs +1.0, Nabers 0.0, Tyson +0.2, Love +0.5); the big movers
  are kickers, defenses and backup QBs, i.e. feed disagreement, not news. Root
  cause: any ADP averages drafts already completed, so it lags news by
  construction. Proposed instead: keep FP consensus as the base and add Sleeper
  as a genuinely new third source (~0.5 FP / 0.25 Yahoo / 0.25 Sleeper), and
  lean on ECR for recency since experts re-rank immediately.*
- ✅ 2026-08-29 — **Draft board only shows ~4 rows** on desktop and mobile after
  the last change; wants ~50% taller so it shows 6.
  *Done — the cap assumed `.cell`'s 34px min-height, but a populated cell (pick
  label + wrapped name) runs ~60px, so six rounds' worth of height showed four.
  Row height is now an explicit `--board-row-h`: 60px desktop, 74px mobile.*
- ✅ 2026-08-29 — **Fix two roster name spellings in the live data**: Jonathan →
  Jonathon Brooks (Robert's team — should stop showing in the draft pool and
  show a real keeper value), and the Jacory Croskey-Merritt typo (Jiro's team).
  *Done — corrected in the fallback roster, plus a verified `NAME_ALIASES` map
  so the misspellings resolve regardless of data source (the authoritative
  roster is in KV, which this session can't write to now that accounts gate the
  API). Also hardened `rebuildKeepers()`: saved selections in `assigned` store
  the name as spelled at the time, so correcting a roster spelling would orphan
  the saved pick and silently drop the keeper — `keeperCostFor()` now resolves
  through the same alias/normalisation. Verified both spellings place Brooks on
  Robert at 10.01, remove him from the pool, and show his real value of +2.*
- ✅ 2026-08-29 — **Pick trade interface** — user: "a big improvement, looks
  great at first glance."
- ✅ 2026-08-29 — **FantasyPros authentication for projections.** User has a
  free FP login, no paid subscription. Willing to buy one if needed. Wants to
  know whether a free login is enough, and if not, how to set up auth.
  *Answer: **no subscription needed, and no login at all.** The paywall is on
  the website UI, not the JSON API. `/v2/json/nfl/2026/projections?position=ALL
  &scoring=HALF&week=0` returns 598 records, 546 with point totals — and with
  component stats (`pass_yds`, `pass_tds`, `rush_yds`, `pass_yds_300`,
  `rush_yds_100`, …), which is exactly what this league's scoring quirks need:
  6-pt passing TDs, 300/450 passing bonuses, rushing first downs, 40+ yard
  bonuses. So real league-specific projections are computable rather than
  borrowing FP's generic 4-pt-TD numbers — the raw material for roadmap item 5
  is free and available. Not yet wired in.*

- ✅ 2026-08-27 — **Draft Room layout: board on top, list underneath (desktop).**
  Wants the draft board moved above the player list on desktop, and the board
  itself scrollable — about 6 rounds visible, scroll for the rest.
  *Done — board card moved directly under the draft controls, above the
  pool/roster grid. `max-height` sized to ~6 rounds with `overflow:auto`, and
  `.h` headers made `position:sticky` so the team names stay visible while
  scrolling rounds.*
- ✅ 2026-08-27 — **Mobile: the draft board doesn't render the entire width.**
  Bug, not a preference.
  *Done — root cause: `renderBoard()` set `grid-template-columns` as an *inline*
  style, which no media query can override, and `minmax(120px,1fr)` tracks
  collapsed on a narrow viewport. The column count now travels as a `--teams`
  CSS custom property and the track list lives in the stylesheet, so a
  `max-width:760px` rule can swap to fixed 104px columns — wider than the
  viewport, so horizontal scrolling actually reaches every team.*
- 🆕 2026-08-27 — **Why are projections missing for many players?** (question)
- 🆕 2026-08-27 — **Wants fresher ADP.** Current pool carries noise from 2+
  weeks ago — players drafted higher/lower before signings, injuries and
  preseason performances moved them. Thinks FantasyPros has something more
  recent but isn't sure how reliable. Asked what the ADP formula currently is
  ("is it just 50/50 standard FP and Yahoo?") and whether it needs adjusting.
- ✅ 2026-08-27 — **Keepers tab values look stale/wrong.** Jonathan Brooks shows
  val -89 though he's clearly being drafted much higher. Is it a name→player
  linking failure, outdated ADP/ECR on that tab, or both?
  *Answer: purely name linking — the ADP data is fine. The roster said
  "Jonath**a**n Brooks", the pool says "Jonath**o**n Brooks", so `findPlayer()`
  returned null, `adpRoundOf()` fell back to its `99` sentinel, and
  `keepValue` computed `10 − 99 = −89`. His real value is **+2** (cost R10,
  ADP round 8) — a bargain the app was calling a disaster. Audited all 196
  roster entries against the pool: **38 were unlinked**, all showing the same
  fabricated ≈−89. Three causes, all addressed: (1) two genuine misspellings
  fixed in the roster data (Jonathon Brooks, Jacory Croskey-Merritt — the
  latter was "Jaocry"); (2) every team defense was unlinked because rosters use
  nicknames ("Broncos") and the pool uses full names ("Denver Broncos") —
  `findPlayer` now falls back to a DEF/DST-only suffix match, recovering 6 of
  them; (3) the rest (~25) are genuinely outside the top-250 pool (Aiyuk,
  Mixon, most kickers, 17 of 32 defenses), so `adpRoundOf`/`keepValue` now
  return **null** and the UI shows "—" with a tooltip instead of inventing a
  number. Sorting treats null as last rather than coercing to 0, and
  auto-assign no longer ranks unrated players against rated ones.*
- ✅ 2026-08-27 — **Trades must support re-trading picks.** A pick that was
  already traded can be traded again. Wanted flow: pick the team giving up the
  pick → dropdown lists the picks that team *currently* holds → pick the team
  receiving it.
  *Done exactly as described. The old form was Round + from + to, and computed
  `overall(round, OWNER_SLOT[from])` — i.e. it could only ever move a team's
  *own original* pick, so an acquired pick was untradeable and picking the
  wrong round silently moved the wrong pick. Now: from-team → a pick list built
  from `picksHeldBy(slot)` (current ownership, so acquired picks appear, tagged
  "via <original owner>") → to-team. Trading a pick back to its original owner
  deletes the override rather than storing a redundant one, and the trade list
  now names both managers instead of "→ T4".*
- ✅ 2026-08-27 — **Verify keeper slot assignment.** When a keeper is selected,
  assign the *lowest* pick that team has available in the cost round. Multiple
  keepers in the same round: assign in any order. If the team has no pick left
  in that round, walk *earlier* (a 10th-round cost → try 9th, then 8th, …) —
  never skip the payment, never accept a later round.
  *Was broken, now fixed. `resetDraft()` did `overall(k.round, k.team)` — the
  team's own original pick in the cost round — which ignored trades entirely
  (a keeper could be placed on a pick the team no longer owned), collided
  silently when two keepers shared a round (two `picks` entries with the same
  `overall`), and had no fallback. Rewritten to walk the team's **current**
  holdings: least-valuable (latest) pick in the cost round first, each keeper
  consuming a distinct pick, falling back to earlier rounds only. Read
  "lowest pick" as lowest-value = latest in the round, consistent with the
  user's "do not accept a lower round" for the fallback direction. Keepers that
  can't be paid at all (every pick at or before the cost round traded away) are
  now listed with a ⚠ instead of silently disappearing. Verified against four
  scenarios: same-round collision, cost round traded away, an acquired second
  pick in the round (burns the later one), and fully unpayable.*
- 🔧 2026-08-27 — **Player headshots — worth it?** Explicitly doesn't want to
  burn time/credits/storage or complicate the Cloudflare setup; asked for a
  recommendation given everything else due in a few days.
  *Recommendation reversed 2026-08-29. Originally "skip it" — but the same
  FantasyPros feed carries `player_image_url` per player (e.g.
  `images.fantasypros.com/images/players/nfl/22968/headshot/210x210.png`). That
  removes both objections: no name→ID crosswalk to build, since the URL rides
  along on records we'd already ingest, and no storage, since they're
  hotlinked. Cost drops from ~half a day to a CSV column plus an `<img>`.
  Still the user's call on whether it's worth any time at all.*
- 🆕 2026-08-27 — **Strategy Lab: hold.** User still needs to work out how they'd
  actually use it before giving feedback; unsure it's useful to them yet. Do
  not build anything here.
- 🆕 2026-08-27 — **Stated next priorities** (after the fixes above): Leagues,
  Commish, and auction strategies; then how to incorporate personal rankings
  and how those shift per league type (bestball, guillotine).

- ✅ 2026-08-27 — **Real accounts: Google sign-in, first account is admin.**
  User asked to make sure only the admin sees Commish and the other
  administrative tabs, and said the "account login functionality that allows
  different users to have their own configurations" was missing — with their
  account (kyos) as admin "since it was the first one that signed in."
  Searched all 33 commits and every branch: no login/account UI has ever
  existed in this repo, so that was an unbuilt feature (roadmap item 7), not
  a regression — said so plainly rather than pretending to restore something.
  *First attempt was wrong and got reverted:* a shared `AUTH_TOKEN` password
  behind a "Sign in" button and "★ Admin" badge, which looked like an account
  system but wasn't one, and was dormant besides (verified against the live
  app — `/api/whoami` returned `{"admin":true}` and `/api/setup` served real
  data to an anonymous curl). User: *"I don't understand how it knows I'm
  admin without a login, or how someone is supposed to create their own
  account."* Correct on both counts. They chose to drop it and build the
  real thing with Google sign-in.
  *Done — reverted that commit (`git revert`, so PR #12's net diff is the
  draft-room features again), then built actual accounts: Google OAuth
  (`/auth/google/start|callback`, `/auth/signout`), HMAC-signed HttpOnly
  session cookies, a `user:<sub>` record per Google account, `/api/me`, and
  an admin-only `/api/users`. **The first account to sign in becomes admin**,
  and re-signing in never re-grants it. Three server-enforced tiers: admin
  (everything), signed in (own private keepers/trades/picks/mocks, read-only
  on shared league profiles, no Commish/Leagues/Data/imports), signed out
  (Draft Room sandbox, nothing saves — same as a `?guest=1` link). The admin
  keeps the original unprefixed KV keys so the owner's existing draft prep
  carries over with zero migration; everyone else gets `:u:<id>` keys.
  Still dormant until `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set —
  unavoidable, OAuth needs an OAuth app — but this time the header says
  "⚠ Accounts off — everyone has full access" instead of hiding it. Setup
  steps in `SPECS.md` → "Accounts (Google sign-in)"; **whoever signs in first
  is admin, so sign in before sharing the URL.** Tested: full sign-in flow
  against a mocked Google token endpoint (first-user-admin, no re-promotion,
  CSRF state mismatch → 400), all three tiers against the real route table,
  per-user data isolation, forged cookie → 401, and accounts-off →
  byte-identical legacy behavior.*

- ✅ 2026-08-26 — **Draft-room decision support push** (user: "ready for next
  features"). Picked the four unambiguous 🆕 backlog items that make the room
  more useful on the clock rather than starting a roadmap item that needs the
  user in the loop: tiers, run/scarcity cues, rewind-to-any-pick, and draft
  grading — each marked ✅ on its own entry below, all folded into
  `SPECS.md` → "Draft Room". The two big roadmap items (league-aware
  rankings engine, live draft sync) are untouched on purpose — the user
  asked to design the first one together over phone/Remote Control, and the
  second is the next scheduled block.

- 🔧 2026-08-25 — **Roadmap/priority order, as of today.** User wants friends
  actively using the app now for feedback. Stated order: (1) this push —
  board row/header fixes, keeper cost/value view, friendlier roster entry
  UI, guillotine/bestball categories [all below]; (2) commissioner mode,
  started today; (3) league-aware custom rankings/projections engine, 2-4
  days, needs several discussions (phone/Remote Control), the real blocker
  for guillotine/bestball; (4) live draft capability (see the 2026-08-24
  "Live draft assistance" entry — was deprioritized, now scheduled for the
  next 2-3 days); (5) multiple people/separate save files, fits in after
  commissioner mode, alongside league-aware and live draft work. Recorded
  here so a future session picks up the right thread without re-asking.
- ✅ 2026-08-25 — **Commissioner mode** (roadmap item 4 in `CLAUDE.md`) —
  track per-league membership: returning y/n, dues owed/paid, contact info.
  Not started as of this morning; user asked to start today.
  *Done (v1) — new **Commish** tab, one row per owner (returning
  yes/no/unsure, dues owed/paid in $, contact, notes), auto-saves to the
  cloud via a new `GET/PUT /api/commish` endpoint — a separate KV entity
  (`commish:<league>`) from `/api/setup` on purpose, since this is league
  administration, not draft/roster state, and shouldn't get mixed into
  keeper/trade backups or wiped by a league-profile restore. Same
  versioned-backup pattern as `/api/setup`/`/api/leagues`. Scoped per league
  like everything else. Hidden entirely in guest mode. First pass — no
  polish pass on what fields matter most yet, revisit if asked.*
- ✅ 2026-08-25 — **Multiple people logging in with separate save files** —
  user's friend is now testing the app (via the guest link) and this came up
  as a "maybe later" idea: real multi-user accounts, each with their own
  save data, rather than one shared setup per league. Explicitly low
  priority ("not that important"). Would need real auth (the app currently
  has none beyond the optional `AUTH_TOKEN` env var that gates the whole
  API, not per-user) — a bigger lift than guest mode's UI-only trick. Not
  started.
  *Done 2026-08-27 — built once the user asked for it directly; see the
  Google sign-in entry at the top of this file. This was roadmap item 7 in
  `CLAUDE.md`.*
- ✅ 2026-08-25 — **AEO-Keepers draft order was wrong: Edward/Aren slots
  swapped** — user's friend (testing via the guest link) caught that Edward
  should be slot 9 and Aren slot 8, not the reverse. Real keepers and pick
  trades already existed for both, so the fix had to touch more than just
  `ownerSlot` — a pick trade recorded as "overall #53 belongs to slot 9"
  meant slot *9* at the time (Aren, under the wrong order), and after
  swapping the slots that same stored `9` would silently point at Edward
  instead. *Done — swapped `ownerSlot.Edward`/`ownerSlot.Aren` on the league
  profile, then remapped every `pickOwnerOverride` value and every
  `picks[].slot` field that was `8` or `9` (swapping them) so trades and the
  6 pre-placed keeper picks still point at the right person under the
  corrected order. Applied directly via the API (pure data fix, no code
  change, nothing to deploy) — verified counts unchanged (34 keepers, 20
  pick-trade entries, 33 picks) and both `/api/leagues/aeo-keepers` and
  `/api/setup` auto-backed-up the pre-fix state first, so it's a one-click
  restore away if anything looks wrong.*
- ✅ 2026-08-25 — **Guest/demo mode for the Draft Room** — user wants to show
  a friend the app without exposing other leagues' data, real keepers/trades
  beyond the Draft Room, or letting them save/change anything (trades,
  keepers, mocks). Wants a separate URL or a "guest login." Scoping the
  robustness (hide-the-UI only vs. also blocking the API itself from guest
  writes) with the user before building — see conversation.
  *Done — `?guest=1` locks the app to AEO-Keepers, Draft Room only. User
  chose UI-only enforcement (not a real auth/API lockdown) as the right
  tradeoff for "just show a friend." `saveSetup()` no-ops in guest mode so
  no pick/undo/queue action ever reaches the cloud; the other views'
  `<section>`s are removed from the DOM entirely at boot (not just
  CSS-hidden) so a right-click "Inspect" doesn't leak trades/keepers/other
  leagues either. A technically motivated friend could still hit the API
  directly from devtools — accepted, not in scope.
- ✅ 2026-08-25 — **SEC-only view for NCAA Power 5 Football** — that league is
  5 conferences × 12 teams, unique rosters *within* a conference only (so a
  given player can be legitimately owned by up to 5 different teams
  league-wide, one per conference). User is in the SEC (Auburn) and this
  league is already post-draft, so it's in-season-management territory now,
  not draft prep. Explicitly optional ("if you can view specifically SEC
  then good, otherwise don't worry about it") — deferred, not started.
  *Done 2026-08-25 — generalized beyond just this one league: user pointed
  out "NFL Promotion & Relegation" has the identical shape (3 divisions ×
  12 teams, English-football-style; promotion/relegation between seasons
  isn't modeled, only the current season's division scoping matters). This
  also explained a bug from the earlier MFL-import session: the "A.J. Brown
  owned by 5 different franchises" case wasn't a name collision — verified
  via MFL's raw data that all 5 rosters carry the identical MFL player id
  (14104), one real A.J. Brown legitimately rostered once per
  division/conference, since each runs its own independent draft. That
  session's "fix" (renaming repeats to "Name (TEAM)") was actively wrong —
  it fragmented one real player into 4 fake ghost copies. Replaced with
  proper division scoping: `GET /api/import/mfl/:id` now detects multiple
  divisions/conferences (MFL models both; friendlier conference names like
  "SEC"/"ACC" are preferred over the more common generic "Division 1..5"
  labels when a commissioner set them) and returns a division picker
  instead of guessing; re-requesting with `&division=<id>` imports just
  that division's 12 teams as its own ordinary league profile — no new
  in-app "conference" concept needed. Re-imported both of the user's
  leagues correctly scoped: NCAA Power 5 → SEC (Auburn's conference), NFL
  Promotion & Relegation → League One (Arsenal's division).*
- ✅ 2026-08-25 — **Roster panel doesn't sort by ECR within a position** — a
  worse-ECR keeper (e.g. a earlier-drafted keeper) was camping the exact
  starter slot ahead of a better-ECR player drafted later, who should have
  bumped the keeper to FLEX instead. Example: Quinshon Judkins (keeper)
  showing as RB1 ahead of James Cook and Josh Jacobs despite both having
  better ECR.
  *Done — `slotRosterPlayers()` sorts the roster by ECR (best first) before
  filling exact-position slots, so better-ECR players win the exact slot and
  push worse-ECR ones down to FLEX/bench.*
- ✅ 2026-08-24 — **MFL (MyFantasyLeague.com) import** — user has leagues
  there, wants the same kind of import Sleeper already has. MFL is an old,
  long-running platform with a historically simple export API (often no
  OAuth needed for a commissioner-enabled public export) — worth checking
  before assuming it's as involved as Yahoo's OAuth flow.
  *Done 2026-08-24 — `GET /api/import/mfl/:leagueId?year=` (mirrors the
  Sleeper route exactly: structure-only, review-before-save, never
  auto-saves). Tested live against the user's two leagues: league 42578
  ("NCAA Power 5 Football", 60 franchises, 1404 rostered players — college
  team names as owners) and league 49263 ("NFL Promotion & Relegation", 36
  franchises, no rosters yet — pre-draft). MFL's player export uses
  numeric IDs ("Last, First" names) cached 24h in KV like Sleeper's
  dictionary. MFL doesn't expose a keeper flag or draft round via this
  export, so every player comes back FA/NONE — set keepers on Teams &
  Keepers after saving, same limitation Sleeper import already has. New UI
  card on the Leagues tab, right below the Sleeper one.*
- 🆕 2026-08-24 — **Live draft assistance synced to an external platform**
  (Yahoo/Sleeper/MFL) — during an actual draft happening on one of those
  sites, refresh in this app to pull the live picks so far and use it as a
  real-time companion (not just a one-time structure import). User
  explicitly deprioritized this ("can probably make do without it") —
  curious whether it's possible, not asking for it now.
- 🆕 2026-08-24 — **ESPN / FanTracks import** — no current leagues on either
  platform; might join one in the next week or two. Explicitly deferred,
  lowest priority of the platform-import requests.

- ✅ 2026-08-24 — **Roster panel rework** (elaborates the 2026-08-24 "can't see
  a rival's roster" entry above): dropdown to view any owner's roster
  (defaults to mine); reposition so it's next to Best Available instead of
  requiring a scroll — move "My picks & projected availability" down (below
  the draft board is fine); slot players into starters-then-bench (not a
  flat list) so you can see how full a starting lineup is at a glance.
  *Done — "Roster" card promoted to the top of the right column with an
  owner dropdown (defaults to you); starters shown slot-by-slot (empty ones
  say "— empty —"), bench below; "My picks & projected availability" moved
  to a new card below the draft board.*
- ✅ 2026-08-24 — **Player pool size to ~200, later 250+ for some leagues** —
  wants to see what happens with a bigger pool (current AEO CSV has 184,
  draft is 192 slots). This needs sourcing more ranked players, not just a
  code change — flagged to the user rather than fabricating ADP/ECR values
  for extra players, since accuracy here matters for real draft prep.
  *Done — see the 2026-08-24 "ADP/ECR data feels stale" entry below for the
  full investigation; pool expanded 184 → 250 rows using a live FantasyPros
  pull, which has real ADP-consensus depth to ~338 players so 250 has
  headroom before hitting fabricated/synthetic data. 250+ for other leagues
  is just a matter of pulling more rows the same way.*
- ✅ 2026-08-24 — **League *type* beyond keeper/redraft: dynasty, guillotine,
  bestball.** Dynasty: no keeper cost/value — every rostered player is
  assumed kept by default, removable individually later (e.g. a roster-space
  cut), rather than today's opt-in "choose up to N keepers" model. Applies
  now to the two new Sleeper-imported leagues. Guillotine and bestball are
  "maybe later," not scoped — explicitly deferred by the user. This is a new
  concept distinct from `draftType` (snake/auction/linear) and needs a
  design pass before building (see conversation — proposed as a `leagueType`
  field, confirming with the user before implementing).
  *Done 2026-08-24 — new `leagueType` field (`keeper`/`redraft`/`dynasty`) on
  the league profile, editable in the Leagues tab. Dynasty: Teams & Keepers
  shows every rostered player pre-checked ("kept"); unchecking one cuts them
  back to the draft pool (`cutPlayers`, opt-out — the inverse of classic
  keepers' opt-in `assigned`). No cost round is needed or used. Redraft: the
  keeper UI is hidden entirely, nobody's ever eligible. Confirmed against the
  user's real MFL leagues: 42578 "NCAA Power 5 Football" → dynasty, 49263
  "NFL Promotion & Relegation" → redraft. Surfaced and fixed a real bug along
  the way: MFL's ~2600-player pool has genuine name collisions (multiple
  different players named "A.J. Brown"), which the app's name-keyed roster
  model would silently resolve to whichever franchise's import line
  processed last — fixed by having the MFL import disambiguate repeat names
  with the colliding player's MFL team in parens.*
  *Update 2026-08-25 — added `guillotine` and `bestball` as selectable
  `leagueType` values too, per the user: what actually differentiates them
  (how players get ranked/valued, e.g. bestball caring about weekly ceiling
  more than season-long ADP) needs the league-aware custom
  rankings/projections engine, which is a bigger multi-day design effort
  (see FEEDBACK entry below) — not built yet. For now they're categorized
  the same as `redraft` (no keeper concept) so leagues of these types can
  exist and run ordinary mock drafts; real differentiation comes later.*
- ✅ 2026-08-24 — **Linear draft type** — a third `draftType` alongside snake/
  auction: same team order every round, no snaking. Trades must still work.
  User notes dynasty drafts using this will have far fewer available players
  (most already kept) and doesn't think that needs special handling.
  *Done — `overall()`/`slotForOverall()`/`posInRound()` branch on
  `draftType==='linear'` to skip the round-reversal; every other part of the
  engine (trades, board, Strategy Lab) is built on those three functions, so
  it inherited linear support automatically. Selectable in the Leagues tab.*

- 🆕 2026-08-24 — **Player headshots** — next to drafted picks, possibly in
  Best Available too, for faster visual scanning. User explicitly deferred
  this themselves, anticipating it's a bigger lift — correctly: our player
  list is name-keyed with no image source. Would likely need a name→image
  crosswalk via Sleeper's player IDs (already integrated) rather than a
  simple UI change. Not started.

- ✅ 2026-08-24 — **Incident: Sleeper import overwrote the AEO-Keepers league
  profile.** User was viewing AEO-Keepers in the Leagues tab, used "Import
  from Sleeper" intending to create a new league, and Save silently PUT the
  imported data over AEO-Keepers instead — the import pre-filled the form
  but never cleared which league was being edited. Restored immediately from
  the hardcoded fallback still embedded in `public/index.html` (owners,
  ownerSlot, rostersRaw, name all recovered); the separate `/api/setup`
  data — keepers, trades, tendencies, in-progress picks — was never touched,
  since it's a different KV key entirely.
  *Done — two fixes shipped: (1) `importFromSleeper()` now resets
  `editingLeagueId` to null so an import always creates a new league,
  never overwrites whatever was selected; (2) league profiles now get the
  same rolling 30-snapshot backup history as `/api/setup`
  (`GET/POST /api/leagues/:id/history|restore`), with a restore panel in the
  Leagues tab, so a future mistake here is a one-click undo instead of a
  manual data-recovery exercise. See SPECS.md → "League profiles".

- 🔧 2026-08-24 — **Live walkthrough, in progress.** User is running a draft
  on-screen and narrating friction points. Entries below are from that
  session; more may follow as it continues.
- ✅ 2026-08-25 — **Draft board row misalignment** — when a cell's content
  wraps to a different height than its neighbors (e.g. a longer player name),
  rows across team columns fall out of sync, making the grid hard to read
  across teams at a glance.
  *Done — root cause: each team was its own independent block-stacked `.col`
  div, so a taller cell only pushed *that* column's later cells down, not the
  row as a whole. Rebuilt `#boardGrid` as a true CSS grid (explicit
  `grid-template-columns`, header + every round's cells appended as direct
  grid children in row-major order) so a row's height is shared across every
  column natively — no JS height-syncing needed.*
- ✅ 2026-08-25 — **Draft board column headers show "T1"/"T2" instead of
  owner names** — hard to tell at a glance whose team a column is without
  cross-referencing the draft order elsewhere.
  *Done — headers and traded-pick tags (`→T4`) both now show the real owner
  name via a new `ownerLabel(slot)` helper, falling back to `T<slot>` only if
  `SLOT_OWNER` genuinely has no name for that slot.*
- ✅ 2026-08-24 — **Traded picks are hard to track on the board** — a traded
  pick shows in its original slot's column with a "→T4" tag; user finds this
  hard to parse and considered wanting it to show under the new owner's
  column instead, but wasn't sure that's actually better on reflection —
  showing owner names instead of "T4" (see above) may be enough to fix this
  without restructuring where traded picks appear. Revisit after that ships.
  *Done 2026-08-25 — resolved by the column-header fix above: the tag now
  reads `→<Owner Name>` instead of `→T4`. Not restructuring where traded
  picks physically appear on the board — that idea was already shelved by
  the user pending this fix, and this fix was enough.*
- ✅ 2026-08-24 — **Can't see a rival's roster without scrolling, and can only
  see "my" roster** — wants a dropdown to pull up any owner's roster (not
  just mine), and wants the roster panel repositioned/prioritized ahead of
  "My picks & projected availability" so it's visible without scrolling —
  specifically so they can check the on-the-clock team's roster/needs while
  deciding a pick.
  *Done — shipped in the roster-panel rework: an owner dropdown next to Best
  Available (defaults to you) showing any team's roster slotted into starters
  + bench, sitting in the top grid above the board and above "My picks", so
  it's the first thing on screen rather than a scroll away. Marked ✅ here on
  2026-08-26 — the entry was left 🆕 by the session that built it.*
- ✅ 2026-08-24 — **ADP/ECR data feels stale** — user has specific players in
  mind whose ADP should have dropped and ECR should have changed due to
  recent injuries, but the app doesn't reflect it. CLAUDE.md says a Cowork
  scheduled task refreshes this every Friday — worth checking whether that
  task is actually running/succeeding, or whether the lag is upstream
  (FantasyPros itself), before assuming the pipeline is broken.
  *Investigated 2026-08-24 — the "Cowork scheduled task" doesn't exist: no
  such routine turned up in `RemoteTrigger`'s list (only a daily KV-backup
  routine and unrelated other-repo check-ins). CLAUDE.md's claim was
  aspirational, not real — will correct it there. Separately, `proj` had
  never actually been populated in `players-2026.csv` (100% zero across all
  184 rows) despite CLAUDE.md describing a projections blend; the *embedded*
  copy in `index.html` did have real projections for 175/184 rows from an
  earlier one-off pull (2026-08-03) that was never written back to the CSV
  file — the two had quietly diverged. Fixed by pulling live from
  fantasypros.com directly (ECR + blended FP/Yahoo ADP, confirmed their
  half-PPR consensus rankings go 882 deep) and rebuilding both files at 250
  rows; also recovered season-long FPTS projections for the 59 players
  FantasyPros exposes without a login (full projections are paywalled).
  Shipped as PR #4 on `hkeseyan/aeo-draft-lab`, pending merge/deploy.*
- 🆕 2026-08-24 — **Custom/personal rankings** — wants the ability to enter
  their own player rankings instead of relying solely on ECR. User explicitly
  deferred this themselves ("we can keep it that way until we develop a
  different page or something") — not blocking, revisit later.
- 🔧 2026-08-25 — **League-aware custom projections/rankings engine** — a
  projections model unique to each league type's actual scoring incentives
  (e.g. bestball caring about weekly ceiling more than season-long value,
  guillotine caring about early-season floor since a bad week can eliminate
  you, a keeper league weighting age/contract-years higher). User explicitly
  deferred this themselves ("maybe that's something we can build later, not
  in this next iteration") — bigger idea, not scoped yet.
  *Elevated 2026-08-25 — this is now the actual blocker for guillotine/
  bestball leagues having any real identity beyond a label (see the
  leagueType entry above): "the main difference... is really going to be how
  I rank the players." User wants to spend the next 2-4 days designing this
  together via several discussions (planned over phone/Remote Control) —
  not a solo build. Nothing implemented yet; this entry is the anchor for
  that design work across sessions.*
- ✅ 2026-08-24 — **Friendlier roster/keeper entry UI for new leagues** —
  today, populating League B/C's rosters/keepers means pasting pipe-delimited
  text into the Leagues tab's raw textarea (works, but not friendly). User is
  fine continuing to paste data via chat for now (or using the existing raw
  textarea directly) until either Yahoo import lands or this gets a proper
  form — explicitly deferred, not needed yet.
  *Done 2026-08-25 — "Edit rosters with a form instead of raw text" button on
  the Leagues tab builds a per-owner card (add-player row + a table of
  existing entries with a remove button) from the current Owners +
  Rosters-raw fields; every add/remove immediately re-serializes back into
  `#lgRostersRaw` in the same `owner|player|drafted|keeper` format, so
  nothing else about saving/loading a league profile had to change — this is
  a friendlier editor for the exact same data, not a new data model. One-way
  sync (raw → builder) on open; re-click the button to resync after a manual
  raw edit.*
- ✅ 2026-08-24 — **Tendency bias granularity too fine** — half-point steps
  (-3 to +3 by 0.5) were more precision than the user ever actually uses.
  *Done — step is now whole integers only (-3..3 by 1); typed-in fractional
  values round to the nearest integer on change.*
- 🆕 2026-08-24 — **Possible future: bulk-set a league-wide baseline
  tendency** — e.g. "RBs go earlier / QBs go later than usual in this
  league" as a market-wide adjustment, separate from per-owner tendencies.
  User plans to hand-edit individual owner values for now and says that's
  fine; would only want tooling here if hand-editing across a whole league
  becomes too much work. Explicitly deferred, revisit if asked.
- 🆕 2026-08-24 — **Rookie flag on players** — wants to see rookie status
  alongside position, not just POS tags. No data source for this in the
  current CSV pipeline (`players-2026.csv` has no rookie/experience column)
  — would need sourcing (FantasyPros data often carries this) before this
  can be built, not just a UI change.

- 🆕 2026-08-20 — **Planned: live walkthrough.** User offered to run a draft
  on-screen and talk through how they actually use the features. Worth doing
  before building more UI — the Draft Wizard research had to be done from
  search results (fantasypros.com is blocked by the sandbox egress proxy), so
  first-hand observation is the best calibration available. Capture what comes
  out of it as new entries here.
- 🆕 2026-08-20 — Overall direction: make the app look/feel/behave closer to
  **FantasyPros Draft Wizard** (a working baseline, not a clone — it stays
  custom to this league). Researched their feature set and wrote a gap
  analysis into `SPECS.md` → "Target feature set (Draft Wizard baseline)".
  The individual features below are the broken-out backlog from that.
- ✅ 2026-08-20 — **Player queue** — pre-rank/star players you want, shown as
  an ordered shortlist during the draft; Draft Wizard queues players and
  surfaces the top queued option when you're on the clock.
  *Done 2026-08-24 — a "Q" checkbox column in Best Available adds/removes a
  player from a "My Queue" card (ADP order); queue entries drop out of view
  once that player is drafted (by anyone) and reappear automatically on
  undo, since it's a display filter over the live pool, not a one-time
  removal. Persists via /api/setup like keepers/trades/tendencies.*
- ✅ 2026-08-20 — **Tiers** — group players into tiers with a visible break
  in the pool list, plus a "N left in this tier" counter that turns red as a
  tier empties. Currently `players-2026.csv` has a `tier` column that the app
  parses but never displays.
  *Done 2026-08-26 — the CSV's `tier` column was in fact being dropped at
  parse time (`parsePlayers()` stopped at `proj`) and dropped again on export,
  so it's now kept in both. Best Available shows a `Tier 3 · 7 left` break row,
  red at ≤3 left, counted over the currently filtered rows so with the RB
  filter on it reads "7 left at RB". Breaks only fire when crossing into a
  deeper tier — the pool is ADP-sorted and tiers come from ECR, so honoring
  every tier change produced 94 header rows in a 220-row list.*
- ✅ 2026-08-20 — **Smarter rival pick logic** — today rivals pick randomly
  within an ADP noise window. Draft Wizard weighs roster needs + positional
  scarcity per team, and offers Basic vs Advanced modes. Wants: rivals
  respect starting-lineup needs and stop taking a 3rd QB in round 8.
  *Done — rivals now score on ADP + roster need + tendency, with a hard veto
  on positions at their depth cap. See SPECS.md → Opponent model.*
- ✅ 2026-08-20 — **Per-owner draft tendencies** (our version of "Draft
  Intel") — since this is the same 12 guys every year, let each owner carry a
  tendency profile (e.g. "Taron reaches for QB early", "Jiro is RB-heavy
  rounds 1-3") that biases their sim picks. Toggle per owner.
  *Done — per-owner QB/RB/WR/TE bias with enable toggles on the Teams &
  Keepers tab; persisted in saved config.*
- ✅ 2026-08-20 — **Player pool is smaller than the draft** — `players-2026.csv`
  has 184 players but the draft is 192 slots (12 × 16), so mocks run dry ~8
  picks early and the last round or two become forced scavenging. Either
  extend the CSV past 192 or shorten `LEAGUE.rounds`. Surfaced while testing
  the new opponent model.
  *Done 2026-08-24 — pool extended to 250, see the "ADP/ECR data feels
  stale" entry above.*
- ✅ 2026-08-20 — **Post-draft analysis / draft grade** — after a mock: grade,
  projected standings/finish vs the other 11 rosters, positional ranks,
  strengths & weaknesses, and biggest steals/reaches vs ADP.
  *Done 2026-08-26 — "Draft analysis" card at the bottom of the Draft Room,
  run on demand (works mid-draft too, not just after): all 12 teams ranked by
  roster value with an A+…F grade, starter slots filled, per-position ranks,
  your row highlighted; plus top-5 steals and top-5 reaches vs ADP. Value is
  ECR-based rather than projection-based on purpose — `proj` only exists for
  the players FantasyPros exposes without a login, so grading on it would
  score half the board as zero. Grades are z-scores against that draft's own
  12-team field, so they describe this draft, not an absolute standard.
  K/DST are excluded from steals/reaches (everyone waits on them, so they
  "fall" 20+ spots every draft and would crowd out the real ones). Not
  building the "projected standings/finish" half — that needs a season
  simulation; roster-value ranking answers the same question here.*
- ✅ 2026-08-20 — **Pick-value & scarcity cues on the clock** — show runs
  ("4 RBs gone since your last pick"), positional scarcity warnings, and
  who's likely gone before your next pick (already partly present as
  "projected availability" — wants to be more prominent).
  *Done 2026-08-26 — a cue strip directly under the draft controls (top of
  the Draft Room, above the fold): positional counts of everything taken
  since your last pick, the top tier still on the board at each of
  QB/RB/WR/TE with its count reddening at ≤3, and how many players are
  likely gone before the pick *after* the one on the clock with the first
  three named (★ = queued). Updates on every pick, undo, and rewind.*
- ✅ 2026-08-20 — **Redo / rewind to any point** — Draft Wizard can restart a
  mock from any earlier pick to test a different branch. Today there's only a
  single-step `undo()`.
  *Done 2026-08-26 — click any non-keeper cell on the draft board (or the `↩`
  on a filled "My picks" row) to rewind to that pick after a confirm: it and
  everything after it are undone and the clock goes back there. Keepers are
  pre-placed and never rewound. Single-step undo still there.*
- ✅ 2026-08-20 — **Keeper cost/value view** — a dedicated read on each
  keeper: cost round vs ADP round, surplus value, and which rival keepers are
  bargains. The math exists (`keepValue`) but isn't surfaced as its own view.
  *Done 2026-08-25 — new "Keeper cost/value" card on the Data tab: every
  currently-kept player league-wide, owner/pos/cost round/ADP round/value,
  sorted best-value-first. Only shown for classic round-cost keeper leagues
  (`leagueType==='keeper' && keeperCostType==='round'`) — dynasty has no cost
  round, dollar-cost auction keepers aren't comparable to a round, redraft
  has no keepers at all.*
- ✅ 2026-08-23 — **Multi-league support, League Manager, versioned backups,
  Sleeper import.** Built independently (local Claude Code session, no
  network access to this repo at the time) alongside today's PR #2 merge —
  reconciled together once both were discovered. League profiles (settings,
  owners/slots, rosters, player pool) moved from hardcoded consts into
  KV, editable from a new **Leagues** tab (create/edit/delete, no code
  changes needed); a header dropdown switches the active league and every
  `/api/*` route scopes by `?league=`. Also adds: draft-pick and player/
  keeper trades (new **Trades** tab); full cloud persistence of keepers/
  trades/tendencies/in-progress picks (previously only keepers+trades
  round-tripped, a real draft-in-progress could be lost on reload); a
  rolling 30-snapshot backup history with one-click restore; and a
  best-effort Sleeper-league import (owners + rosters, reviewed before
  saving — Sleeper doesn't expose ADP/projections or draft type). See
  SPECS.md → "League profiles".
- ✅ 2026-08-18 — Draft order should be editable from within the app (today
  it's a hardcoded constant, `OWNER_SLOT`, in `public/index.html`; no UI to
  change it).
  *Done — solved by the above: the Leagues tab's owner/slot editor.*
- 🆕 2026-08-18 — More feature ideas exist from a prior Claude Cowork spec
  session, not yet transcribed here — user will bring them over from another
  device. Once added, triage each into its own entry below.

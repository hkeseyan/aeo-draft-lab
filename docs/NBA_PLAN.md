# NBA plan — requirements and the handoff brief

Captured 2026-10-01, at the end of the NHL build. The next session starts here.
`docs/MULTISPORT_PLAN.md` holds the original cross-sport reasoning; this file is
NBA-specific and names the exact code that has to change.

## Progress

**2026-10-01 — build step 1 done.** Built: the `nba` sport pack; composite roster
slots (`slotGroups` in the pack, read by `playerFillsPos()`, `rosterEligiblePositions()`,
`countsOf()` and `posCell()`, with hockey's Fantrax F expressed the same way and its
behaviour unchanged); the `yahoo-nba-public-points` reference league; a 335-player
2026-27 pool (`PLAYERS_CSV_NBA`); `computeMyRanksNba()` for points leagues; NBA
headshots; the "My slot" control for NBA. `SPECS.md` → "Basketball (NBA)" has the
behaviour. Step 2 is partly done as a side effect, because the board needed a real
pool: market ADP and stats-based projections are in; what step 2 still owes is
listed below.

**2026-10-01, later — the user's part-2 direction applied.** Built:
- **My Rank is pure value order:** no ADP guardrail, no positional premium.
- **League value column sorts.**
- **Projection blend** (Hashtag 50 / FantasyPros 25 / ESPN 25, attempts without
  FantasyPros), with a live `GET /api/nba/preseason-projections` refresh.
- **Per-platform eligibility and market:** Yahoo, Fantrax and Sleeper positions;
  Fantrax and Sleeper ADP.
- **Build step 3:** `isCategoryLeague()` is ungated for basketball, with
  volume-weighted FG%/FT%.
- **Templates:** Yahoo H2H Cat, Yahoo Roto, Fantrax Best Ball (provisional) and
  Sleeper Lock-In (provisional).

Steps 1-3 are therefore in place for drafting. See `SPECS.md` → "Basketball (NBA)".

**Answers to the user's part-2 questions (checked 2026-10-01):**
- **Fantrax with league ID `xna4w7nnmona530f`:** it is **SBCFBL**.
  - The league:
    - 30 teams.
    - `HEAD_TO_HEAD_ROTI_SINGLE_WIN` with category weights: PTS 61; AST and TS%
      41; BLK, ST, OREB, DREB, +/-, 3PT% and 2PT% 31; FT% and TO 21; MIN 11.
    - Lineup PG, SG, SF, PF, C plus 3 Flx; 17 players.
    - Twice-weekly scoring periods, playoffs from period 37.
  - **What Fantrax's public API returns:**
    - League-scoped eligibility for **1,284 NBA players** (the source of
      `fantrax_pos`).
    - Exact scoring-period boundaries.
    - Rosters and draft results.
    - **No projections**, for any league. The ID only needs to be a real NBA league
      for eligibility, not the league the projections are for.
    - **No contract or salary fields**, so SBCFBL's contracts need another source.
- **Fantrax week handling, from SBCFBL:** 3-4-day periods. The **All-Star break is
  one long period (Feb 17-26)**. Every Fantrax league's periods can be read from the
  API rather than assumed.
- **Yahoo weeks 2026-27** (Yahoo's schedule article):
  - Week 1 is 6 days (from Tue Oct 20).
  - **Week 7 (Nov 30-Dec 13) and Week 17 (All-Star, Feb 15-28) are 14-day
    matchups.**
  - Default playoffs are Weeks 20-22 (Mar 15-Apr 4).
- **NBA Cup:** group and knockout games count; **only the championship game (Dec
  11) does not count**, which confirms the user's memory.
  - Sleeper's schedule lists 80 games per team; the other 2 are the Cup knockout
    games scheduled in December.
- **DARKO:**
  - What it is: a **next-game, per-100-possession** projection of most box-score
    stats (points, assists, rebounds, steals, blocks, turnovers, FT%, 3P%,
    shooting by zone, usage), plus minutes and starting role.
  - Update speed: **after every game**, so performance-driven role growth shows up
    within a day.
  - Gaps: no season totals or games played; its about page names no injury-news
    input.
  - Access: CSV downloads are offered.
  - So it covers our categories as rates and is fast, but would need our own games
    and availability layer to become a season or rest-of-season line.
- **FantasyPros league sync:** the existing MyPlaybook connector reads one league
  per MyPlaybook link (`?key=`), and returns that league's **matchup roster, not its
  settings**. Pulling the four Yahoo + one Fantrax leagues needs each league's
  MyPlaybook link. Settings still have to come from the platform (Fantrax: league
  ID; Yahoo: API once provisioned) or the user.
- **Basketball Monster:** projections are subscriber-only; the free page is
  2025-26 actuals.

**2026-10-02 — part-3 direction applied.**

*Built:*
- Turnovers at 25% of a normal category.
- An H2H z floor of −2 (Hashtag's default H2H ranking), calibrated so Giannis is
  5th, matching Hashtag; roto keeps the full penalty.
- The basketball live recommender, with paths: BEST VALUE / BALANCE / BUILD for
  categories, NEED / CROWDED for points.
- Hockey's ADP guardrail removed.
- Sleeper Lock-In working roster: 9 starters, 6 bench, 1 IR.
- The real **TRAX10 Best Ball (5)** league (`2g9d05jbmuaop7st`), with confirmed
  Fantrax Best Ball rules and primary-position-only G/F/C eligibility. The user's
  team is set with "My slot".
- Fantrax ADP refreshed (320 rows).

*Research, 2026-10-02:*

- **Replacing FantasyPros' 25%:**
  - **CBS Sports** is the strongest free candidate. Its
    `cbssports.com/fantasy/basketball/stats/<POS>/2027/season/projections/` pages
    have 2026-27 season totals with **FGM/FGA, FTM/FTA, 3PM/3PA**, GP, minutes, PTS,
    REB, AST, STL (and further columns), 100 rows per position.
  - Caveat: CBS projects near-full health (Luka 79 GP), so blend its per-game rates
    with the other sources' games rather than its totals.
  - Ruled out: RotoWire (projections paywalled), Basketball Monster (subscription),
    Razzball (free page stale or paywalled), numberFire/FanDuel Research (no season
    projections page found).
  - Sleeper fits only inside the ESPN/Sleeper 25% cap.
  - Awaiting the user's choice.
- **Minus-1, H2H and alternatives:**
  - Hashtag's **H2H** setting is Standard with each category floored at −2. Its
    **Minus-1** drops each player's worst category.
  - Hashtag's *default* view is H2H, per-game averages, 20% games-missed penalty,
    TO 0.25.
  - Basketball Monster's **DURANT H2H** drops turnovers plus the next-lowest
    category.
  - **G-scores** (Rosenof, arXiv 2307.02188) add week-to-week variance to the
    z-score denominator for H2H. Relative to Z they shrink steals most (44% of Z),
    then FG% 56%, FT% 58%, TO 62%, PTS 65%, BLK 68%, REB 69%, 3PM 72%, AST 75%.
    In that paper's simulations, G-score drafters beat Z-score drafters heavily.
    Roto barely needs the adjustment.
  - **H-scoring** (Rosenof, arXiv 2409.09884) is dynamic. It weights each category
    by how close the team is to a 50% win rate in it, so it learns to punt. The
    recommender's balance/build paths are a simplified form of it.
  - Adopted: the −2 floor. Proposed for later: G-score weights for H2H (a
    noticeable re-weighting, so the user's call) and Hashtag's per-game basis with
    a games-missed penalty instead of full season totals.
- **Best Ball strategy (for the next step):**
  - Fantrax counts each week's top 4 G / 4 F / 2 C by weekly total, so **games
    per week** dominate a week (2-5 games). One study found a rotation player's best
    game runs ~15% above average in 2-game weeks and ~32% in 4-game weeks, so
    ceiling and volatility add value beyond the mean.
  - Depth beyond the counting slots covers rest and injuries; there's no IR and no
    moves. Common guidance is about twice the counting slots, i.e. ~8 G / 8 F /
    4 C, within the 12/12/5 limits.
  - Injured stars who return midseason cost only a bench spot.
  - Late-season tanking teams hand young players big minutes in March-April, while
    contenders rest stars.
  - Teammate stacking is weak in the NBA (usage competition within games, pace
    effects across a season); the only rule is that a roster can't be all one NBA
    team.
  - A proper valuation simulates weekly scoring: games per week from the schedule,
    per-game mean and spread, availability, and the top-N per position.
- **Priorities (user):** finish the generic draft strategy → lock in Best Ball
  strategy → return to the finer details of the other drafts.
  - Lock-In: discuss draft strategy first, then in-season lock decisions and
    reminders.
  - SBCFBL waits until drafting is solid (trades and deep waivers later; contracts
    tracked elsewhere).
  - DARKO is a target for after the drafts, on top of our own availability layer.

What research established on 2026-10-01:

- **`stats.nba.com` times out from the agent container** (curl, browser headers, 30s).
  Not needed for now: FantasyPros' **NBA projections page is free** (season totals for
  266 players, unlike football's paywalled ones), and Sleeper publishes NBA season
  stats (`/v1/stats/nba/regular/2025` = 2025-26) and per-game projections with
  attempts (`/v1/projections/nba/regular/2026`, 529 players).
- **FantasyPros works exactly as it did for hockey**: `ecrData` in the rankings HTML
  (311 players, 6 experts, roto scoring), and the ADP page is a plain table with
  **Yahoo** and **ESPN** columns (223 rows). FantasyPros carries four stale duplicate
  prospect records (Morez Johnson Jr., Darius Acuff Jr., Mikel Brown Jr., Terrence
  Shannon Jr. listed again as FA); the pool build drops them.
- **Fantrax `getAdp?sport=NBA` works with no auth** (312 rows), same as hockey.
- **Yahoo defaults** (help SLN6919): Public leagues default to **10-team H2H Points**,
  PTS 1 / REB 1.2 / AST 1.5 / STL 3 / BLK 3 / TO -1, roster PG, SG, G, SF, PF, F, C, C,
  Util, Util + 3 BN + 3 IL, daily changes, 4 adds/week. **Public Prize basketball is
  exactly 12 managers** (official rules), H2H Points / H2H Categories / Roto, live
  standard or auction drafts only. First game week: **Tue Oct 20, 2026**.
- **Yahoo "High Score"** is Yahoo's new default for private leagues: draft 10, start 6
  (2 G, 3 frontcourt, 1 Util), and each starter's **single best game of the week**
  counts; PTS 1, REB 1, AST 2, STL 3, BLK 3. Not offered for Public Prize.
- **"Lock-In" is Sleeper's mode**: one game per player per week counts, chosen by the
  manager after it is played and before his next game; the player must have been in
  that day's starting lineup. It is the manual cousin of Yahoo's High Score. Both
  reward single-game ceiling over games played, which is the draft implication for
  build step 5.

**Still owed by step 2:** a projection blend led by the sources the user trusts
(see "User direction" below: Hashtag first, with Yahoo/Fantrax once reachable;
FantasyPros demoted to at most a low weight); a refresh path that is
not a by-hand pull (hockey's is `/api/nhl/preseason-projections`); Fantrax ADP wired
for Fantrax leagues (`/api/nhl/fantrax-adp` is hockey-only); tiers (FantasyPros'
NBA `ecrData` carries none). Anchors found for later steps: Yahoo source sync picks
its game key at `worker.js` `profile.sport === "nhl" ? "nhl" : "nfl"`, so an NBA
league would query football; the live recommendation card and streaming controls
are gated to `SPORT.id==='nhl'`.

**Refreshing the pool by hand:** curl the three FantasyPros pages (`/nba/rankings/
overall.php`, `/nba/adp/overall.php`, `/nba/projections/overall.php`) and Sleeper's
`/v1/players/nba`, `/v1/projections/nba/regular/2026` and `/v1/stats/nba/regular/2025`,
then rebuild the CSV with the same joins (FantasyPros id; Sleeper name + team or
position; drop same-name FA records with no data) and bump `poolDataRevision`.

## User direction (2026-10-01) — sources, schedule, positions, categories

Captured from the user's second message of the NBA session; they are still reading
and will add more. Nothing below is built yet except where it says so. FEEDBACK.md
has the short form.

### Projection sources

**What the current pool uses.** `proj` comes from FantasyPros' **stat projections**
(season totals per category: its projections page, not its rankings). Its ECR
rankings are kept separately as the `ecr` column, as for hockey.

**The user's trust order.** FantasyPros is not a reliable NBA source to the user.
It's acceptable as one input to a collective average, since it does project its own
stats, but no more. **Yahoo and Fantrax rank above it**, and they matter for a second
reason: opponents mostly view projections in their platform's app, so a platform's
own projection predicts how opponents value players. **Hashtag Basketball** is
trusted, and the user has Hashtag Premium. **Basketball Monster** is on a similar
tier or better, but the user has no subscription.

**What's reachable, checked from the agent container on 2026-10-01:**

| Source | Free access | What it gives |
|---|---|---|
| Hashtag Basketball projections | **Yes.** The default page shows 30 players; an ASP.NET postback with the "show" dropdown set to All returns **all ~430** without a login | 2026-27 per-game projections with GP, MPG, **FGM/FGA, FTM/FTA**, 3PM, PTS, REB, AST, STL, BLK, TO, plus Hashtag's own z-score total. A positions dropdown switches between **Yahoo, ESPN and Fantrax eligibility**, a possible source for the missing platform eligibility. Premium does not appear to be needed for projections; it adds tools like the premium schedule grid and waiver tools. |
| Hashtag Advanced NBA Schedule Grid | Yes (page loads) | Weekly grid, Yahoo-style weeks (W1 = 19-25 Oct, W7 = 30 Nov-13 Dec spans the NBA Cup break) |
| Basketball Monster | **Rankings page only.** Its free view is **2025-26 actuals** with per-category values; the 2026-27 projections page redirects (subscriber-only) | Last season's per-game stats with attempts and usage, and per-category values. Useful as a z-score methodology reference, not as a projection |
| ESPN (unofficial fantasy API) | Yes | 2026-27 stat projections (season 2027, stat source 1, 31 stat ids per player) |
| Sleeper API | Yes | 2026-27 per-game projections with attempts (529 players); Sleeper ADP. Sleeper is one of the user's NBA platforms, so this is what opponents there see |
| Yahoo | **Blocked** until Yahoo provisions the app's Fantasy API access (expected roughly Oct 3-10, see FEEDBACK.md) | Yahoo's own projections; the opponent view for Yahoo leagues |
| Fantrax | No public projection feed among the endpoints we use (`getPlayerIds`, `getAdp`); needs a look with a real league ID | Fantrax's own projections; the opponent view for Fantrax leagues |
| FantasyPros | Yes | Season-total stat projections without attempts (the current `proj`) |

**Proposed shape (for the user to confirm).** Mirror the hockey pattern of raw-stat
sources blended *before* league scoring is applied, with two layers kept apart,
like Market $ vs Target $ for auctions:
- **Our projection** (drives My Rank): a weighted blend of the sources the user
  trusts, with Hashtag first. ESPN and Sleeper are candidates, and FantasyPros at
  most a low weight. Yahoo and Fantrax join once reachable. Weights are the user's
  call.
- **Platform view** (opponent modelling): the league's own platform projection
  (Yahoo for a Yahoo league, Fantrax for a Fantrax league), kept as its own column.
  It's the in-app number opponents see, the same reason rivals draft against
  platform ADP.

**Other sources to vet** (suggestions only; the user confirms reliability):
- ESPN projections and Sleeper projections (both free, above).
- **DARKO**, a free public NBA projection model well regarded by analysts. It's a
  Shiny app, so access needs a closer look.
- numberFire (FanDuel Research).
- RotoWire (paid).

### Schedule grid and the playoff-week tiebreak

- The user consults Hashtag's **Advanced Schedule Grid** constantly for **NBA, NHL
  and MLB**. We can build our own from raw schedule data rather than depend on it.
  It barely matters at the draft but is **critical in-season for all three sports**.
- **NBA schedule data:** Sleeper's free `schedule/nba/regular/2026` returns **1,200
  games, 80 per team**, with dates and weeks. A full season is 1,230: each team's
  last 2 games are the **NBA Cup knockout games, scheduled in December**, so a
  per-week games count must treat them as unknown until then.
  - `cdn.nba.com` and ESPN's scoreboard 403 from the agent container. The deployed
    Worker might reach them; not verified.
  - Hockey already has `/api/nhl/schedule`.
- **Playoff-schedule tiebreak in My Rank — low-medium priority.** Only ever sways a
  near-tie: when projections and My Rank are otherwise very close and one player
  plays 3-5 more games across the league's 2-3 fantasy-playoff weeks. It must never
  carry Giannis over Wembanyama.
  - Requires an absolutely solid schedule integration.
  - Requires the **playoff weeks confirmed per league, for that draft**, plus that
    platform's week boundaries.
  - **The weight is 0 whenever the playoff weeks are unknown or uncertain** from what
    the user has provided.
  - Yahoo's documented default is playoffs in weeks 20-22. That's a default, not a
    confirmation for any specific league.

### Positions — do not repeat the NHL treatment

- **Basketball F and C are different positions.** In hockey C is a subset of F.
  Yahoo hockey has no Flex or Util, which made eligibility a big deal there.
- Basketball differs in several ways:
  - Production is more even across positions.
  - Players are often both F and C.
  - Util and the G/F slots add flexibility.
- The user's hockey experience was that C is deeper and outproduces other positions.
  Whether basketball C does the same in points leagues is unconfirmed; it may just
  be stat diversity.
- **Current build:** F is SF/PF only and a pure C does not fill F (a PF/C fills
  both), per Yahoo's slot rules. There is no hockey-style C-only markdown or
  multi-forward markup.
  - **Resolved 2026-10-01: removed.** It was a small data-driven positional premium.
    C-eligible players get about +73 Yahoo points a season (about 1 point a game,
    roughly 2%) because the best undrafted C projects slightly below the best
    undrafted player overall.
  - The user confirmed: no inherent C bonus and no double-counting. Tier gaps belong
    to the valuation metrics, never a flat per-position shift. My Rank is now pure
    value order.
- **Multi-eligibility** is slightly more valuable, but on a balanced roster it
  evens out. It matters in **heavy punt builds**. Example: hard-punt FT%,
  soft-punt 3PM and AST.
  - Anchors like Giannis, Zion and Gobert set the build.
  - Then guards who supply AST and 3PM are worth more to the user than yet another
    mid-round C, regardless of their FT%.
  - The back end can be filled with Cs nobody else wants.
  - My Rank may inflate those players for that build. In such builds the user also
    values "out of position" eligibility and players who stretch into extra
    positions. Mostly a category-league concern.
- **Points-league recommender: position-blind until the roster leans too far.**
  - Example: six rounds in, three PG-only players and no PF-eligible player. Stop
    recommending PG-only players and boost PF increasingly until one is taken.
  - Judge on full multi-eligibility, not the listed primary. Three PG/SG players
    still want a PF, but barely penalize another PG-only.
  - With three PG-only, a PG/SG counts as an SG, because that's where he will play.
  - The `slotCounting:'capacity'` counting built in step 1 already models "where
    he will actually play"; the recommender is not built.

### Categories (H2H and Roto)

- **Category scarcity matters more than position.** Use it in VORP- and VORS-style
  metrics on z-scores, as Hashtag and Basketball Monster do.
- **FG% and FT% are volume-weighted.** Examples:
  - 10 FTA/g at 88% beats 4 FTA/g at 92%.
  - 10 FTA/g at 65% effectively forces a FT% punt.
  - 4 FTA/g at 72% is manageable if the team carries few bad FT shooters.
  - 1.5 FTA/g at 65% barely matters.
  - In impact terms: (makes − league rate × attempts) per game.
- **Scarce categories are valued earlier** than ones available late or on waivers.
- **Points correlate with many categories.** Early players with volume FT%, FG% and
  3PM usually bring points. A strong points foundation can then be pushed over the
  line by streaming; without the foundation, streaming rarely gets there.
- **Turnovers:** the user usually soft-punts TO, especially at the top of the draft,
  then reassesses. **Punting AST means not punting TO.**
- Punting and dynamic draft strategy will be discussed during live drafts.

**Data check of the user's experience** (Hashtag 2026-27 per-game projections,
2026-10-01; 12 teams × 13 rounds = 156 drafted; market order is Hashtag's ADP, then
its value; "waiver" = market ranks 157-260; league FG% .484, FT% .792 over the
drafted pool):

| Category | Where the top-24 producers go: R1-3 / R4-8 / R9-13 / waiver | Best 10 on waivers as % of the top 12 |
|---|---|---|
| PTS | 21 / 3 / 0 / 0 | 57% (15.8 vs 27.7/g) |
| REB | 11 / 9 / 3 / 1 | 62% |
| AST | 17 / 5 / 1 / 1 | 61% (5.1 vs 8.5/g) |
| STL | 8 / 7 / 2 / 7 | **87%** |
| BLK | 4 / 9 / 4 / 7 | 75% (1.45 vs 1.94/g) |
| 3PM | 10 / 11 / 1 / 2 | 78% (2.7 vs 3.4/g) |
| FG% impact | 6 / 6 / 5 / 7 | 64% |
| FT% impact | 11 / 11 / 1 / 1 | **44%** |
| TO (fewest) | 0 / 0 / 9 / 15 | — |

**Where the data agrees with the user:**
- **FT% at volume** is the scarcest category. It has the lowest waiver ratio, and
  22 of the top 24 go in rounds 1-8 (SGA, Curry, Booker, Reaves, Trae, Harden...).
- **Elite assists and elite points** go early. 37 of the 45 projected 20+ ppg
  scorers go in the first 60 picks. Only 3 come after pick 96, each with baggage:
  Jalen Green at a 42% FG, LaVine listed OUT, and Barrett.
- **Steals and 3PM** are the most replaceable (87% and 78%).
- Mid-level rebounds are available later.
- Low-TO players are all late, so drafting stars means accepting TO.

**Where the data adds nuance:**
- **FG% and blocks are both available late, through low-usage centres.** 7 of the
  top-24 FG% impact producers and 7 of the top-24 shot-blockers are waiver-level:
  Poeltl, Queta, Lively, Kalkbrenner, Maluach, Robert Williams.
- *Anchor-volume* FG% (Giannis at 60.8% on 19.9 FGA) and true elite blocks
  (Wembanyama, 3.2) are early and unique. But 1-1.5 FG% impact and ~1.5 bpg are a
  late-centre commodity.
- That fits the user's own note that the back end can be filled with Cs nobody
  wants: a punt-FT% build gets FG% and blocks cheaply there.

**Caveats:**
- These are preseason projections. In-season waiver value from injuries and role
  changes is invisible to them, and that's where much real waiver value appears.
- Per-game, not schedule-adjusted.
- One source (Hashtag).

## Status going in

NHL drafting is winding down. The user may be done; they are still looking for a
**Yahoo Roto Public Prize** league for a couple of days, but those are having trouble
filling. If none fills, NHL drafting is finished and NBA begins. Nothing in the NHL
work is left unfinished — `FEEDBACK.md` has no open 🆕/🔧 items, and the last loose
end (a test file missing from `npm test`) is closed.

## What the user asked for

- **Platforms: Yahoo, Fantrax and Sleeper for certain.** Possibly one or two more
  depending on factors not yet decided.
- **League types: H2H Points, season-long Points, H2H Categories, Roto.**
- **Lineup cadence: daily-changers, weekly-lineups, Lock-In, Best Ball.** Mostly
  in-season concerns, but they still matter at the draft.
- **Draft formats: snake, auction, snake with 3rd-round reversal, linear**
  (non-snaking, common in dynasty).
- **Retention: redraft, dynasty, keeper, possibly with a salary/contract component.**
- **Fantrax Best Ball** — NHL had no equivalent. Its roots are in NFL fantasy, the
  user knows the format, and the app does not support it in any real sense yet.
- **NBA "Lock In"** (or whatever the per-league feature is actually called) must be
  planned for.
- **Start with the simple use cases, then build out.**

## What already transfers, and what doesn't

Most of the NHL work was deliberately built sport-agnostic. Verified against the code
on 2026-10-01:

**Transfers as-is**
- Sport packs (`SPORTS`), the header sport switcher, per-sport league-dropdown
  scoping, position colours and filters.
- Per-league roster positions: `rosterPositionOrder()` + `rosterEligiblePositions()`
  already project a player's eligibility onto whatever slots a league rosters. NBA's
  PG/SG/SF/PF/C plus G/F/Util is the same mechanism as hockey's F/D/G.
- Multi-position eligibility and the per-platform `eligibility` map
  (`yahoo`/`fantrax`/`fallback`), including the provenance warning on the board.
- `findPlayer(name, pos)` disambiguation for same-name players.
- Draft geometry: `overall()`, `posInRound()` and `slotForOverall()` are the **only**
  three functions that know draft order. Snake, linear and auction already exist.
- The VORP My Rank shape: value, positional replacement level, flexibility bonus.
- Add Radar's schedule/opportunity logic (it needs an NBA schedule source).
- Fantrax, Sleeper and MFL importers; the review-before-save policy.

**Needs real work**
| What | Where | Note |
|---|---|---|
| An `nba` sport pack | `SPORTS` in `public/index.html` | only `nfl` and `nhl` exist |
| Ungate the category engine | **`isCategoryLeague()` is hardcoded to `SPORT.id==='nhl'`** | this is the single biggest blocker; 9-cat NBA is category-native |
| Season-long Points as a distinct mode | `scoringMode` is `points`/`categories`/`roto` | cumulative-no-matchup is a fourth shape |
| Lock-In cadence | `lineupPeriod` is `daily`/`weekly` | needs a third value and draft-time implications |
| Best Ball behaviour | `leagueType:'bestball'` **already exists but behaves as redraft** | no new type needed — it needs real semantics |
| 3rd-round reversal | the three geometry functions above | localized; rounds 1–2 snake, round 3 repeats round 2's order |
| Salary/contract retention | auction keeper machinery exists for football | dynasty-with-contracts is a further step |
| Sleeper NBA import | `worker.js` hardcodes `players/nfl` | Sleeper does cover NBA; make it sport-aware |
| NBA player pool + market ADP | new | see below |

## Data sources to establish

The NHL pattern was: our own projection from a public stats API, real market ADP from
a third party, and a separate expert-consensus column, kept as three columns rather
than blended. Repeat that shape.

- **Stats**: `stats.nba.com` is the obvious analogue to the NHL public API. Note the
  NHL API had to be fetched with **curl, not python urllib** (the agent proxy 403s
  the latter) — expect the same constraint.
- **Market ADP**: FantasyPros' NBA pages are very likely the same trick that worked
  twice for NHL — `ecrData` embedded as JSON in the rankings page HTML, and an ADP
  page broken out per host site. Check that first.
- **Fantrax ADP**: `getAdp?sport=NBA` by analogy with the working NHL call. The NHL
  feeds needed no auth and no league ID.
- **FantasyPros My Playbook exists for NBA** (unlike NHL), so in-season league sync
  has a fallback hockey never had.
- Nine-cat NBA needs **volume-weighted rate categories** (FG%, FT%) — a 60% FG on
  three attempts is not a 60% FG on twenty. This is the classic place naive category
  rankings go wrong; see `docs/MULTISPORT_PLAN.md`.

## Suggested order, simple first

1. `nba` sport pack + a points-scoring Yahoo reference league, so the board renders.
2. NBA player pool: stats-based projection scored through the league's point values,
   plus real market ADP.
3. Ungate `isCategoryLeague()` and get 9-cat working with volume-weighted rates.
4. Roto and season-long Points.
5. Best Ball semantics, then Lock-In cadence.
6. 3rd-round reversal, then dynasty/keeper with contracts.

## Carry-over cautions from the NHL build

- **Dedupe the pool by player id**, and require position compatibility before
  accepting a name match. Both bit us: a traded player appeared twice and could be
  drafted twice in one mock, and two same-named players merged their market ranks.
- **Any profile sharing an embedded pool needs its own `poolDataRevision`**, or a
  corrected pool never reaches that profile's already-seeded cloud copy.
- `tests/validate-fantastic-data.mjs` slices `index.html` between two markers —
  nothing may be inserted between `FANTASTIC_2026_STRATEGY` and the
  `// ---------- LEAGUE PROFILES` banner.
- Expect other sessions to be editing `main` concurrently. Sync before starting and
  before pushing; prefer their mechanism over inventing a parallel one.
- A projection built on one prior season has no mean reversion and underrates
  prospects and role-changers. NHL shipped ADP-anchored guardrails for that reason.

## Open questions for the user

Asked 2026-10-01; answers arrive as the user joins leagues.

1. Which specific NBA leagues, on which platforms, and their settings (league ID,
   teams, scoring or category list, roster slots, draft type and date)?
2. Lock-In: research says it is **Sleeper's** mode (one game per player per week,
   chosen after it is played, starters only). Is that the one, or does another
   platform you'll play have its own version (Yahoo's High Score is automatic)?
3. Which Fantrax Best Ball format — roster size, how many count each period, and is
   the period daily or weekly?
4. Any salary/contract league this season, or is that hypothetical for now?
   **Answered:** SBCFBL (Fantrax) is a dynasty contract league whose rookie draft
   already happened. Wanted for in-season management soon; its contracts aren't
   in Fantrax's public API.
5. **New:** Fantrax H2H Points and Fantrax Roto public prize settings aren't
   published. Any public Fantrax league ID from the lobby would let us read them.
6. ~~Sleeper's default roster~~: commissioner-configured. Working setup per the user
   is 9 starters, 6 bench, 1 IR; each joined league's details come from the user.
9. **New (2026-10-02):** which team is the user's in TRAX10 Best Ball (5)? Set it
   with "My slot". Also: adopt CBS Sports in place of FantasyPros? G-score
   weighting for H2H? Per-game basis with a games-missed penalty?
7. ~~Remove the ADP guardrail from hockey's My Rank too?~~ **Yes** (2026-10-02); done.
8. **New:** to sync the four Yahoo + one Fantrax leagues from FantasyPros, each
   league's MyPlaybook link is needed. The Fantrax import also needs to learn NBA
   player names before SBCFBL can be imported.

# Multi-sport plan — NHL, then NBA, then MLB

Written 2026-09-17, in response to: *"prepare for NHL drafts; leverage what we did
for NFL; maybe a sport toggle at the top; NHL next 2 weeks, NBA the month+ after,
MLB a few months later."* Revised the same day after the user chose **Yahoo default
public leagues** and raised in-season management as a gating concern.

Nothing here is built yet. This is the plan and the reasoning behind it.

---

## 0. Confirmed inputs and decisions

From the user, 2026-09-17:

- **Platform: Yahoo default public leagues.** Will join **at least 2**, then possibly
  other public prize leagues (roto etc.), then custom commissioner-run prize leagues.
- **Retention: redraft only, for now.** No existing keeper or dynasty hockey leagues.
  Would join one *only if we can build great in-season management automation*.
- **If a keeper/dynasty league happens, it would be a startup** — a first-year draft
  with no existing keepers. That matters more than it sounds: a startup draft is
  mechanically an ordinary redraft draft. None of the keeper machinery (`assigned`,
  cost rounds, `cutPlayers`, budget legality) is needed on draft night. What differs
  is *valuation* — age curves and multi-year value — which is the rankings engine's
  job, not the draft room's. **Dynasty is cheap on the draft side and expensive on
  the in-season side**, the opposite of how it looks from the football profiles.
- **First NHL draft: 1–2 weeks out.**
- **Scoring: "whichever is easiest for us to manage."** Answered below — Yahoo's
  default *is* the easy one.

### Decision reversed by research: points first, not categories first

The first draft of this plan said build categories first because it's the harder case
and assumed-default. **Yahoo's default public hockey league is Head-to-Head _Points_**
(§5, verified against Yahoo's own settings page). That means:

- The user's first two leagues need **one number per player** — exactly the shape the
  existing engine already has. The z-score category engine is **not critical path** for
  the two-week window.
- Categories still ship, just later: the roto prize leagues the user may join next need
  it, and NBA's 9-cat and MLB's 5x5 are category-native. It moves from week 1 to the
  NBA month, where it belongs anyway.

This is the single biggest de-risking finding in the plan. The two-week window went
from "build a new valuation engine under time pressure" to "de-hardcode positions and
load a hockey player pool."

### Net effect on week 1
Redraft, points scoring, Yahoo defaults. No keeper code, no category engine.

---

## 1. The toggle question, answered

**Yes to a sport switcher — but sport should be a field on the league profile, not a
separate mode, app, or deployment.**

Add `sport: 'nfl' | 'nhl' | 'nba' | 'mlb'` (defaulting to `'nfl'`) to the league
profile, and put a small segmented control in the header that *filters the existing
league dropdown* (`public/index.html:118-122`, `fillLeagueSelect()` at `:4100`).

Why this shape and not a bigger one:

- **The API needs zero changes.** Every `/api/*` route is already `?league=`-scoped
  and every KV entity is already per-league (`league:<id>`, `setup:<league>`,
  `mocks:<league>`, `commish:<league>`). None of that is football-specific. A new
  sport is just more league profiles.
- **One codebase, one URL, one sign-in, one KV namespace.** Forking the deployment
  per sport would fork `public/index.html` four ways — and this repo has already
  paid once for a production/repo divergence (FEEDBACK.md, 2026-09-03).
- **The dropdown is already the real problem.** With ~10-12 football leagues and
  three more sports coming, a flat list of every league is unusable.
- Persist last-used sport, and last-used league *within* each sport, in
  `localStorage`.

One naming note: the worker, repo, and URL are all `aeo-draft-lab` — named after a
football league. Renaming the worker changes the live URL, which isn't worth it.
Change the in-app title to plain **"Draft Lab"** (and the hardcoded 🏈 at
`public/index.html:4092`) and leave the URL alone.

---

## 2. The core insight: NFL is the outlier, not the template

Everything in the current draft engine rests on four football-only assumptions:

1. A player is worth **one number**, so ranking is sorting.
2. A player has **exactly one position**, from a fixed list of six.
3. Lineups are set **weekly**; games played is not a resource you manage.
4. Roster need means "is a starter slot open," nothing more.

NHL, NBA, and MLB break assumptions 2, 3 and 4 the same way, and break 1 whenever the
league is category-scored:

| | NFL | NHL / NBA / MLB |
|---|---|---|
| Scoring | one projected point total | often **multi-category** — value is a vector |
| Position | one per player | **multi-eligible** (C/LW, PG/SG, SS/2B) |
| Lineups | weekly | **daily**, with acquisition caps and schedule/off-night value |
| Specialists | K/DST as an afterthought | **goalies / pitchers are their own economy** |

Yahoo's default hockey league happens to be points-scored (§5), so assumption 1
survives for the user's first leagues. **Assumptions 2, 3 and 4 break regardless** —
multi-position eligibility and daily-lineup/games-played value are true of every
hockey league, points or not. Those are week-1 work; the category engine is not.

The leverage argument still holds for what comes after: **build the category core
once, and NBA's 9-cat and MLB's 5x5 become mostly configuration.** It just lands in
the NBA month rather than the NHL fortnight.

**Corollary:** this still pulls roadmap item 5 (league-aware rankings/projections)
forward. Hockey has no FantasyPros projections to lean on the way football does
(§6), so our own valuation arrives earlier than planned. Football gets it back —
that engine is what `guillotine`/`bestball` have been waiting on.

---

## 3. What actually changes in the code

A **sport pack** — a plain config object per sport, living in `public/index.html`
in the same spirit as `LEAGUES_DEFAULT`:

```js
SPORTS.nhl = {
  label:'NHL', icon:'🏒', seasonLabel:'2026-27',
  positions:['C','LW','RW','D','G'],
  posColors:{C:'…', LW:'…', RW:'…', D:'…', G:'…'},
  flexDefaults:[],                         // Yahoo's default has no Util slot
  tendencyPositions:['C','LW','RW','D','G'],
  scoringModes:['points','categories'],    // points first — see §0
  depthCap:(pos,starters)=>…,              // replaces the RB/WR+3 rule
  lateRoundPositions:[],                   // NHL has no K/DST analogue
  auctionPosMult:{…},
  dataAdapter:'nhl',
}
```

Then replace the football constants with lookups into it. The full de-hardcoding
inventory — bounded, because the app was already generalized once for multi-league:

| Where | Today | Becomes |
|---|---|---|
| `index.html:2544` `blankCounts()` | `{QB,RB,WR,TE,K,DST}` | built from `SPORT.positions` |
| `index.html:2555` depth cap | `RB/WR ? base+3 : base+1` | `SPORT.depthCap(pos, starters)` |
| `index.html:2565` late-round rule | `K/DST before rounds-2` | `SPORT.lateRoundPositions` (empty for NHL) |
| `index.html:2540` `TEND_POS` | `['QB','RB','WR','TE']` | `SPORT.tendencyPositions` |
| `index.html:2138` `auctionWeight()` `posMult` | football multipliers | `SPORT.auctionPosMult` |
| `index.html:49-50` `.pos.QB{…}` CSS | six fixed classes | generated from `SPORT.posColors` |
| `index.html:3384` `parsePlayers()` | `DEF → DST` normalization | per-sport alias map |
| `index.html:3634` `collectLeagueForm()` | **hardcodes** `flexEligible:['RB','WR','TE']` on every save | read from the form |
| `index.html:4092` `renderHeader()` | literal 🏈 | `SPORT.icon` |
| `index.html:164,228,284` position `<option>`s | six football options | rendered from `SPORT.positions` |

That `collectLeagueForm()` line is already a logged bug — it silently reverts the
SCG IRS league's RB/WR-only flex every time that profile is saved through the UI
(FEEDBACK.md, 2026-09-03). Multi-sport makes it unignorable, so it gets fixed here.

---

## 4. What NHL needs that NFL never did

### 4.1 Multi-position eligibility — week 1
`p.pos` → `p.posEligible = ['C','LW']`, keeping `p.pos` as primary for display and
color. Then `needScore()` (`:2547`), `countsOf()` (`:2545`), `slotRosterPlayers()`
(`:3066`) and the roster panel need "can this player fill this slot" instead of "is
this player this position." Biggest mechanical change in the plan, true of every
hockey league regardless of scoring, and shared verbatim with NBA and MLB.

### 4.2 Games played and schedule — week 1, in reduced form
Daily lineups plus Yahoo's **4 acquisitions per week** cap (§5) make games played a
budgeted resource, not a detail. Week-1 version: per-team games-count and
off-night share as player-pool columns, shown as a column and folded modestly into
value. The full version is the in-season tooling in §6.

### 4.3 Goalies — week 1, minimal
A scarcity cliff, the most volatile position in fantasy hockey, and under Yahoo's
default worth 2 starting slots plus a **3-goalie-games-per-week minimum**. Week-1
version: `G` as its own position with its own depth cap and scarcity tiering in Best
Available. Resist building a goalie model before watching one draft with it.

### 4.4 Category valuation (the z-score engine) — deferred to the NBA month
Not needed for Yahoo default points leagues (§0). Needed for the roto prize leagues
the user may join later, and for NBA/MLB. When it comes: per-category z-scores across
the draft-relevant pool, restricted to the categories the league scores, summed into a
composite that feeds the engine wherever `adp` does today. Two things separate a
correct implementation from a naive one — **rate categories must be volume-weighted**
(a 60% FG on 3 attempts isn't a 60% FG on 20; same for SV%/GAA and AVG/ERA/WHIP), and
**punt-aware re-ranking** (zero out conceded categories and re-rank) which maps onto
the existing Strategy Lab shell.

### 4.5 Tendencies
`TENDENCIES` is hand-set per owner (`:2540`) because it's the same people every year.
**That premise does not hold for public leagues** — the user won't know their
opponents. For Yahoo public leagues, leave tendencies disabled and let the rival model
run on ADP + roster need alone, which is what it already does for unchecked owners.
No new mechanism, but don't bother surfacing the UI for these leagues.

---

## 5. The Yahoo default public league — the concrete week-1 target

Verified against Yahoo's own default-settings page (see Sources at the end):

| Setting | Default |
|---|---|
| Teams | **10** |
| Scoring type | **Head-to-Head Points** |
| Starting roster | **2 C, 2 LW, 2 RW, 4 D, 2 G** |
| Bench / IR | 4 any-position / 2 (must be real-life IR) |
| Max roster size | 18 including IR |
| Roster changes | **Daily** |
| Max acquisitions | **4 per week** |
| Min goalie games | **3 per team per week** |
| Waivers | Continual rolling list, 1-day waiver time |
| Trades | No maximum, 2-day rejection time |
| Playoffs | Weeks 23, 24, 25 — 6 teams, reseeded |

Skater scoring: **G 6, A 4, +/− 2, PPP 2, SOG 0.9, BLK 1**.
Goalie scoring: **W 5, GA −3, SV 0.6, SHO 5**.

Three things fall out of this that shape the build:

1. **No Util/flex slot** in the default, so `flexEligible` is empty and the flex code
   path is simply unused — one less thing to get right in week 1.
2. **14 starters out of 18 roster spots** is a tight bench (4 spots) against a
   4-acquisition weekly cap. Roster churn is constrained, which makes draft-day hit
   rate matter more than in football and makes streaming a real optimization problem
   rather than a free-for-all.
3. **SOG at 0.9 and BLK at 1** materially reward volume shooters and shot-blocking
   defensemen relative to pure point producers — the default scoring is not
   points-only, and a naive "rank by projected goals+assists" board would be wrong.
   Our projection has to be scoring-aware from the start, which is §7.

This table is the league profile to create. Nothing about it is guesswork.

---

## 6. In-season team management — the gap, and what it means

The user asked directly whether we can lean on **FantasyPros My Playbook** for hockey
the way they do for football, and said the answer determines how many leagues to join.

**Verified answer: no. My Playbook does not exist for NHL.**

| Sport | My Playbook |
|---|---|
| NFL | yes |
| MLB | yes |
| NBA | yes — optimal lineups, waiver suggestions, trade suggestions, league analysis |
| **NHL** | **no — `/nhl/myplaybook/` returns HTTP 404** |

FantasyPros' hockey section exists but is **draft-only**: consensus rankings for
2026-27 filterable by C/LW/RW/D/G, and a Draft Mode. No league sync, no start/sit, no
waiver or trade assistant. The crutch the user relies on for football isn't there.

Two consequences:

1. **For NHL, in-season management is ours to build or it doesn't exist.** This is no
   longer "deferred past the drafts" as the first draft of this plan had it — it's the
   thing that decides how many leagues the user joins, and whether dynasty ever
   happens.
2. **NBA has My Playbook**, so the Oct–Nov basketball phase has a fallback hockey
   doesn't. That's an argument for spending the NHL fortnight on drafting and the
   in-season basics, and the NBA month on the deeper engine work.

### The good news: hockey's management problem is unusually automatable

Yahoo's defaults define it precisely — daily lineups, 4 acquisitions/week, 3 goalie
games/week minimum, 4 bench spots. That is a *budgeted optimization*, not a judgment
call, and the inputs are free and machine-readable:

- **NHL public API** (`api-web.nhle.com`, `api.nhle.com/stats/rest`) — no key. Full
  schedule, per-team games per week, rosters, stats.
- **Off-night / light-night value** — nights with few NHL games are when a bench
  player can actually be slotted in. Daily Faceoff publishes strength-of-schedule on
  exactly these three axes (games played, opponent difficulty, light nights ≤8 games);
  Left Wing Lock publishes weekly games-per-team. Both are derivable ourselves from
  the NHL schedule API, which is the durable option.
- **Starting goalies and line combinations** — the daily signal that matters most.
  Daily Faceoff and Left Wing Lock both publish confirmed starters and lines.

A minimum viable management tool is therefore: *given my roster, the week's schedule,
my 4 remaining acquisitions and my 3-goalie-game floor, which adds and which daily
lineups maximize expected points?* That is well-defined, buildable from free data, and
would beat what My Playbook gives for football — because hockey's constraints are
arithmetic in a way football's start/sit calls aren't.

**Recommendation on league count:** start with the 2 Yahoo default points leagues. Add
more only after the management tool ships and survives a few weeks of real use. The
constraint isn't drafting — it's whether 10 daily lineups are sustainable, and that's
an empirical question the tool answers.

---

## 7. Data pipeline for NHL

There is no FantasyPros-of-hockey to pull projections from (§6), so the projection is
ours — which is roadmap item 5 arriving early:

- **NHL public API** — prior-season per-player stats, rosters, and the full schedule
  (which is where §4.2's games/off-night counts come from). Free, no key.
- **MoneyPuck / Natural Stat Trick** — free CSV exports with rate and on-ice data;
  good projection inputs (TOI, power-play time, shot rates). Shot rates matter more
  than usual here because SOG is a scored category at 0.9/shot (§5).
- **Yahoo's own ranks/ADP for the specific league** — the market anchor, and the
  cheapest win in the plan: `worker.js:697` hardcodes `game_keys=nfl` on
  `/api/yahoo/leagues`. Yahoo's Fantasy API is the same shape across sports, so
  that's a one-word change to start listing NHL leagues.
- **Cross-platform ADP differs meaningfully** between Yahoo, ESPN, Fantrax and CBS —
  Daily Faceoff publishes a comparison. Since we're drafting on Yahoo, anchor on
  Yahoo's ADP specifically rather than a blended consensus.
- **Our projection** = prior-season rates × projected TOI/games, **scored through the
  league's own point values** (§5), blended with Yahoo's ranks as the market anchor. Same
  philosophy as football's `0.67*FP + 0.33*Yahoo`, with us supplying the first term.

`parsePlayers()` (`:3373`) already reads whatever columns are present and ignores the
rest, so each sport declares its own column set without touching the parser's contract.

### Yahoo league import
Yahoo integration today is diagnostic-only (list leagues, admin-gated). The Sleeper
and MFL importers prove the shape: pull owners, rosters and settings into the Leagues
form, review, never auto-save. Yahoo returns `settings`, `teams`, `draftresults` and
`players` for any league key with the same URL shape across sports. Worth building
properly — it serves NHL now, NBA and MLB later, and retroactively fixes the football
leagues where owners had to be typed in by hand (FEEDBACK.md, 2026-09-03).

**Caveat:** Yahoo Fantasy API access was pending a manual review as of 2026-08-23.
Until confirmed, everything Yahoo-dependent needs a manual-entry fallback — so it
can't be critical path for a draft two weeks out. Public-league settings are known
(§5) and can be entered by hand, so this is a convenience, not a blocker.

---

## 8. Sequencing

Today is 2026-09-17; first NHL draft is 1–2 weeks out.

### Week 1 (Sep 17–24) — usable
- Sport field, sport packs, de-hardcode the position constants (§3). Header sport
  filter. Fix the `collectLeagueForm()` flex bug while in there.
- Create the Yahoo-default NHL league profile from §5 — `leagueType:'redraft'`,
  points scoring, 10 teams, 2C/2LW/2RW/4D/2G + 4 bench + 2 IR. No keeper code.
- Multi-position eligibility through `needScore` / roster panel / board (§4.1).
- NHL player pool: NHL API + MoneyPuck → projection scored through Yahoo's own point
  values → saved onto the league profile as CSV.
- `game_keys=nhl`, and confirm the real state of Yahoo API access.
- **Target: a working NHL Draft Room with a real pool and mocks running.**

### Week 2 (Sep 24–Oct 1) — sharp, and ready for the season
- Games-played / off-night column and goalie scarcity tiering (§4.2, §4.3).
- Yahoo NHL league import if access allows; manual entry if not.
- Live mock reps against the real league settings, and tune.
- **Start the in-season management MVP** (§6) — schedule + games-per-week view, and
  the acquisition-budget/goalie-minimum framing. It doesn't have to be finished for
  draft day; it has to exist before the season's first full week.

### Oct–Nov — NBA (the full month+)
Sport pack (PG/SG/SF/PF/C plus G/F/Util), the **category z-score engine** including
volume-weighted rate cats, punting as a first-class UI concept, a data adapter, and
per-week games/schedule. The right place to finish roadmap item 5 properly and
backfill it to football (`guillotine`/`bestball`). Sleeper covers NBA, so the existing
Sleeper importer extends there; it does not cover NHL. NBA also has My Playbook as a
fallback, so the pressure is lower than hockey's.

### Feb–Mar — MLB
Biggest pool, 5x5 roto standard, SP/RP split, two-way players, position eligibility
earned by games-played thresholds. By then mostly a data problem rather than an engine
problem — the payoff of building the category core during the NBA month.

---

## 9. Risks

- **The two-week window got safer, not safe.** Points scoring removed the need for a
  new valuation engine, but multi-position eligibility (§4.1) is still a real refactor
  of the need/roster logic, and the player pool still has to be built from scratch.
- **In-season management is now a requirement, not a nice-to-have**, and it's entirely
  ours to build for hockey (§6). The risk is scope: the MVP is the schedule/
  acquisition-budget/goalie-minimum view, *not* a full daily optimizer. Ship the
  arithmetic first.
- **Yahoo API access is unconfirmed.** Every Yahoo-dependent step needs manual entry
  behind it. §5 means we can build the league by hand if needed.
- **Don't fork the deployment.** One codebase, one URL, sport as data (§1).
- **Public leagues break the tendency model.** Unknown opponents — leave tendencies
  off rather than inventing biases (§4.5).

---

## 10. Open questions

Settled: platform (Yahoo public default), retention (redraft), scoring (points —
Yahoo's default), timing (1–2 weeks), league count starting point (2, revisit after
the management tool ships).

Remaining:

1. **Did the Yahoo developer app's Fantasy Sports API access clear its manual
   review?** (Blocked as of 2026-08-23.) Decides import vs. manual entry.
2. **Which specific public leagues, and when do they draft?** Yahoo public leagues
   are auto-scheduled; the draft date per league is the one thing §5 can't supply.
3. **Dynasty platform, if that ever happens.** Fantrax is the dynasty/keeper standard
   for hockey — automated salaries/contracts, tradeable future picks, deep settings
   customization. Yahoo and ESPN are weaker there. Sleeper does not do NHL at all.
   Worth knowing before joining a dynasty league, not before the redraft ones.
4. **Anything known about the NBA or MLB leagues** that should shape the shared core.

---

## Sources

- [Yahoo — Default league settings in Fantasy Hockey](https://help.yahoo.com/kb/SLN6815.html)
- [Yahoo — Roster and lineup management](https://help.yahoo.com/kb/SLN22673.html)
- [FantasyPros — NHL consensus rankings](https://www.fantasypros.com/nhl/rankings/) (draft-only; `/nhl/myplaybook/` returns 404)
- [FantasyPros — NBA My Playbook](https://www.fantasypros.com/nba/myplaybook/)
- [FantasyPros — My Playbook league sync FAQs](https://support.fantasypros.com/hc/en-us/articles/115000414167-My-Playbook-League-Sync-FAQs)
- [Daily Faceoff — 2026-27 fantasy hockey ADP: Yahoo vs. ESPN vs. Fantrax vs. CBS](https://www.dailyfaceoff.com/news/2026-27-fantasy-hockey-adp-yahoo-vs-espn-vs-fantrax-vs-cbs)
- [Daily Faceoff — weekly strength of schedule and streaming targets](https://www.dailyfaceoff.com/news/fantasy-hockey-2025-26-weekly-strength-of-schedule-and-streaming-targets-week-22)
- [Left Wing Lock — NHL weekly schedule](https://leftwinglock.com/schedules/)
- [Fantrax](https://www.fantrax.com/)

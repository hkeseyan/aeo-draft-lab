# Multi-sport plan — NHL, then NBA, then MLB

Written 2026-09-17, in response to: *"prepare for NHL drafts; leverage what we did
for NFL; maybe a sport toggle at the top; NHL next 2 weeks, NBA the month+ after,
MLB a few months later."*

Nothing here is built yet. This is the plan and the reasoning behind it.

---

## 1. The toggle question, answered

**Yes to a sport switcher — but sport should be a field on the league profile, not
a separate mode, app, or deployment.**

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
  paid once for a production/repo divergence (FEEDBACK.md, 2026-09-03). Don't
  re-create that on purpose.
- **The dropdown is already the real problem.** With ~10-12 football leagues and
  three more sports coming, a flat list of every league is unusable. A sport filter
  fixes that on its own merits.
- Persist last-used sport, and last-used league *within* each sport, in
  `localStorage` — switching to NHL and back should land you where you were, not
  reset to AEO-Keepers.

One naming note: the worker, repo, and URL are all `aeo-draft-lab` — named after a
football league. Renaming the worker changes the live URL, which isn't worth it.
Change the in-app title to plain **"Draft Lab"** (and the hardcoded 🏈 at
`public/index.html:4092`) and leave the URL alone.

---

## 2. The core insight: NFL is the outlier, not the template

It's tempting to treat NHL as "football with different position letters." It isn't.
Everything in the current draft engine rests on four football-only assumptions:

1. A player is worth **one number** (`proj` / `adp` / `ecr`), so ranking is sorting.
2. A player has **exactly one position**, from a fixed list of six.
3. Lineups are set **weekly**; games played is not a resource you manage.
4. Roster need means "is a starter slot open," nothing more.

NHL, NBA, and MLB all break the same four assumptions in the same ways:

| | NFL | NHL / NBA / MLB |
|---|---|---|
| Scoring | one projected point total | **multi-category** (roto or H2H-cats) — value is a vector |
| Position | one per player | **multi-eligible** (C/LW, PG/SG, SS/2B) |
| Lineups | weekly | **daily**, with games-played caps and schedule/off-night value |
| Specialists | K/DST as an afterthought | **goalies / pitchers are their own economy** |

That is the whole leverage argument: **build the category-league core once, for
NHL, and NBA's 9-cat and MLB's 5x5 become mostly configuration plus a data
adapter.** Build NHL as a special case instead and we pay the same cost three
times.

**Corollary worth stating plainly:** this forces roadmap item 5 (the league-aware
custom rankings/projections engine, `CLAUDE.md` → Roadmap). Hockey is not usable
without a version of it — there is no FantasyPros-of-hockey to lean on the way
football does. So the multi-sport expansion and roadmap item 5 are one project,
not two, and item 5 arrives earlier than planned because hockey drags it forward.
Football gets the benefit back: the same engine is what `guillotine` and `bestball`
have been waiting on.

---

## 3. What actually changes in the code

A **sport pack** — a plain config object per sport, living in `public/index.html`
in the same spirit as `LEAGUES_DEFAULT`:

```js
SPORTS.nhl = {
  label:'NHL', icon:'🏒', seasonLabel:'2026-27',
  positions:['C','LW','RW','D','G'],
  posColors:{C:'…', LW:'…', RW:'…', D:'…', G:'…'},
  flexDefaults:['C','LW','RW','D'],        // Yahoo's "Util"
  tendencyPositions:['C','LW','RW','D','G'],
  scoringModes:['categories','points'],
  defaultCategories:['G','A','PPP','SOG','HIT','BLK','W','GAA','SV%'],
  depthCap:(pos,starters)=>…,              // replaces the RB/WR+3 rule
  lateRoundPositions:[],                   // NHL has no K/DST analogue
  auctionPosMult:{…},
  dataAdapter:'nhl',
}
```

Then replace the football constants with lookups into it. This is the full
de-hardcoding inventory — it's bounded, because the app was already generalized
once for multi-league:

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

Five things, in rough order of how much they matter.

### 4.1 Multi-position eligibility
`p.pos` → `p.posEligible = ['C','LW']`, keeping `p.pos` as the primary for display
and color. Then `needScore()` (`:2547`), `countsOf()` (`:2545`), `slotRosterPlayers()`
(`:3066`) and the roster panel all need "can this player fill this slot" instead of
"is this player this position." This is the single biggest mechanical change, and
it's shared verbatim with NBA and MLB — which is exactly why it's worth doing
properly rather than special-casing.

### 4.2 Category valuation (the z-score engine)
For a categories league: compute per-category z-scores across the draft-relevant
pool, keep only the categories the league actually scores, sum → one composite
value, rank on that. The composite then feeds the existing engine wherever `adp`
does today, so the board, rival model, and Strategy Lab keep working unchanged.

Two things that separate a correct implementation from a naive one:

- **Rate categories must be volume-weighted.** SV%/GAA in hockey, FG%/FT% in
  basketball, AVG/ERA/WHIP in baseball. A 60% FG on 3 attempts is not worth a 60%
  FG on 20 — the value is the *impact on your team's aggregate rate*, which scales
  with volume. Getting this wrong is the standard way category rankings go bad.
- **Punt-aware re-ranking.** Zero out the categories you're conceding and re-rank
  the board. It's an NBA staple that works fine in NHL, and it maps naturally onto
  the existing Strategy Lab shell (compare "punt hits/blocks" against "balanced"
  the same way the lab compares RB-RB vs WR-WR today).

Points-league NHL is the easy case — one `proj` number, the existing engine is
already most of the way there. That matters for sequencing (see §6).

### 4.3 Games played and schedule
Daily lineups mean a player on a team with more games — and more *off-night* games,
when fewer other teams play — is genuinely worth more, because you can actually
start them. Minimum viable version: per-team games-count and off-night-share as
player-CSV columns, surfaced as a visible column and a modest modifier on value.
A full schedule optimizer is in-season territory and explicitly out of scope, the
same line football already draws on in-season tools.

### 4.4 Goalies
A scarcity cliff and the most volatile position in fantasy hockey. Minimum viable:
`G` as its own position with its own depth cap and its own scarcity tiering in Best
Available, and let the z-scores carry the valuation. Resist building a goalie model
before we've watched one draft with it.

### 4.5 Tendencies
`TENDENCIES` is hand-set per owner and per position (`:2540`) because it's the same
people every year. That premise holds for whichever leagues these are — it just
needs hockey positions instead of football ones, which the sport pack already
handles. No new mechanism.

---

## 5. Data pipeline for NHL

Football's flow is "manual FantasyPros pull → `players-2026.csv` → embed or PUT to
the league profile." There is no equally deep free hockey equivalent, so the NHL
flow is more of our own making — which is the same work as roadmap item 5:

- **NHL public API** (`api-web.nhle.com`, `api.nhle.com/stats/rest`) — free, no key.
  Prior-season per-player stats, team rosters, and the full schedule (which is where
  §4.3's games/off-night counts come from).
- **MoneyPuck / Natural Stat Trick** — free CSV exports with rate and on-ice data;
  good projection inputs (TOI, power-play time, shot rates).
- **Yahoo's own ranks / ADP for the specific league** — the market anchor, and the
  single cheapest win in this whole plan: `worker.js:697` hardcodes
  `game_keys=nfl` on `/api/yahoo/leagues`. Yahoo's Fantasy API is the same shape
  across sports, so that's a one-word change to start listing NHL leagues.
- **Our projection** = prior-season rates × projected TOI/games, blended with
  Yahoo's ranks as the market anchor. Same blend philosophy as football's
  `0.67*FP + 0.33*Yahoo`, just with us supplying the first term.

Player CSV stays the same mechanism — `parsePlayers()` (`:3373`) already reads
whatever columns are present and ignores the rest, so each sport declares its own
column set in the sport pack without touching the parser's contract.

### Yahoo league import
Yahoo integration today is diagnostic-only (list leagues, admin-gated). The
Sleeper and MFL importers already prove the right shape: pull owners, rosters and
settings into the Leagues form, review, never auto-save. Yahoo returns `settings`,
`teams`, `draftresults` and `players` for any league key with the same URL shape
across sports, so this is worth building properly now — it serves NHL, then NBA and
MLB, and retroactively fixes the football leagues where owners had to be typed in
by hand (FEEDBACK.md, 2026-09-03: *"still blocking real draft-room use: no owner/
team names for any of the three leagues"*).

**Caveat:** Yahoo Fantasy API access was pending a manual review as of 2026-08-23.
Until that's confirmed, everything Yahoo-dependent needs a manual-entry fallback —
so it can't be on the critical path for a draft two weeks out.

---

## 6. Sequencing

Today is 2026-09-17. NHL drafts cluster late September into early October, so the
shape has to be **usable first, general second** — get a real NHL draft room
working, then sharpen it.

### Week 1 (Sep 17–24) — usable
- Sport field, sport packs, de-hardcode the position constants (§3). Header sport
  filter. Fix the `collectLeagueForm()` flex bug while in there.
- Create the real NHL league profile(s) from actual settings.
- Multi-position eligibility through `needScore` / roster panel / board (§4.1).
- NHL player pool: NHL API + MoneyPuck → composite value (z-scores if it's a cats
  league, `proj` if points) → saved onto the league profile as CSV.
- `game_keys=nhl`, and confirm the real state of Yahoo API access.
- **Target: a working NHL Draft Room with a real pool, real owners, mocks running.**

### Week 2 (Sep 24–Oct 1) — sharp
- Category z-score engine done properly, including volume-weighted rate cats (§4.2).
- Punt-aware re-ranking in the Strategy Lab.
- Yahoo NHL league import if access allows; manual entry if not.
- Goalie scarcity tiering; games-played / off-night column.
- Live mock reps against the real league, and tune — same "use it live, log
  feedback, fix it the next day" loop that worked through football's draft season.

### Oct–Nov — NBA (the full month+)
The category core already exists by then, so NBA is: sport pack (PG/SG/SF/PF/C plus
G/F/Util), 9-cat config, punting promoted to a first-class UI concept, a data
adapter, and per-week games/schedule — which matters more in basketball than
anywhere else. The month-plus budget is the right place to finish roadmap item 5
properly and backfill it to football (which is what `guillotine`/`bestball` need).
Note Sleeper does cover NBA, so the existing Sleeper importer extends there; it does
not cover NHL.

### Feb–Mar — MLB
Biggest player pool, 5x5 roto as the default, SP/RP split, two-way players,
position eligibility earned by games-played thresholds, and keeper/dynasty prospect
layers. By then it should be mostly a data problem rather than an engine problem —
which is the entire payoff of building the category core for hockey first.

---

## 7. Risks

- **Two weeks is the tight one.** NHL drafts may land before the category engine is
  polished. Mitigation: points-league support plus "market ranks as the backbone"
  (Yahoo ADP driving the board, the way football's `adp` does) is a legitimate
  week-1 fallback that makes the room usable even with our own valuation unfinished.
- **Yahoo API access is unconfirmed.** Every Yahoo-dependent step needs a
  manual-entry path behind it.
- **Don't fork the deployment.** One codebase, one URL, sport as data. See §1.
- **Scope discipline.** Per this repo's own conventions: no features beyond what's
  asked. In-season hockey tools — streaming optimizer, waiver/FAAB, daily lineup
  setting — are out, the same way football's in-season tools are deferred.

---

## 8. Open questions — needed before week 1 starts

1. **Per NHL league:** platform, team count, roster slots, draft date and draft type
   (snake/auction), and critically — **categories or points?** and **roto or H2H?**
   and **keeper/dynasty or redraft?** The cats-vs-points answer decides whether §4.2
   is critical path or a week-2 nicety.
2. **How many NHL leagues**, and which one drafts first.
3. **Did the Yahoo developer app's Fantasy Sports API access clear its manual
   review?** (Blocked as of 2026-08-23.)
4. **Anything already known about the NBA or MLB leagues** that should shape the
   shared core — e.g. if an NBA league is points-only, that re-weights the effort.

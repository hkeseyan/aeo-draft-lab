# AEO Draft Lab — feature specs

The current, authoritative description of what the app does. This is the
target of the feedback workflow: items resolved from `FEEDBACK.md` get their
resulting behavior folded in here, so the spec always matches what's
actually built (not what was originally planned).

**Pending import**: a prior Claude Cowork session specced out additional
features not yet reflected here — the user will bring those notes over from
another device and they need to be merged in. Until then, treat this doc as
incomplete, not final.

## App shape

Single-page app (`public/index.html`), eight tabs:

### Draft Room
Live mock draft UI. Snake/linear leagues use the best-available pool, roster
viewer, queue, full draft board (dashed cells = keepers), and projected
availability. Auction leagues use a dedicated salary-cap room: editable
player/winner/price sale entry, undo/reset, simulated market sales, a live
best-available table with provisional market dollars, per-team keeper spend /
draft spend / remaining budget / max bid, and the user's auction roster.
Auction state is saved with mocks/setup just like snake picks.

The auction simulator is deliberately an MVP rather than a claim of precise
market forecasting: remaining league dollars are redistributed over the
available player pool after keepers and sales, then opponent need/tendencies
and noise influence simulated bids. The displayed market dollars are scenario
estimates until the league-aware custom rankings/projections and auction-value
engine replace them.

The board sits directly under the draft controls, above the player list — it's
the thing you read first on the clock. It's capped at roughly six rounds tall
and scrolls for the rest, with `position:sticky` team headers so you always
know whose column you're in. Column tracks come from a `--teams` CSS custom
property set by `renderBoard()` rather than an inline `grid-template-columns`,
which is what lets a `max-width:760px` media query swap to fixed 104px columns
on mobile; with inline styles (and `minmax(120px,1fr)` tracks that collapse on
a narrow viewport) the rightmost teams were unreachable.

The board is a genuine CSS grid (every header/cell a direct grid child in
row-major order) so a row's height is shared across every column — a wrapped long name doesn't
push just its own column out of alignment with its neighbors, which a
per-column block-stacked layout couldn't guarantee. Column headers and
traded-pick tags show the real owner name (`ownerLabel(slot)`, falling back
to `T<slot>` only if a slot genuinely has no owner name), not a bare `T1`/
`T2`/`→T4`.

The board is capped at six rounds tall and scrolls for the rest. That cap is
`--board-rows` × `--board-row-h`, with the row height stated explicitly (60px
desktop, 74px mobile) rather than inferred from `.cell`'s 34px `min-height` — a
populated cell carries a pick label plus a wrapped player name and runs far
taller, so sizing off the minimum showed four rounds instead of six.

**Roster**: next to Best Available, a dropdown (defaulting to you) shows any
owner's roster slotted into starters — one row per starting slot in
`LEAGUE.starters` order (exact positions, then FLEX, then SUPERFLEX if the
league has one), with unfilled slots shown as "— empty —" so you can see how
full a lineup is at a glance — then a bench list of whatever's left over.
Best-ECR-first within a position: a worse-ECR keeper doesn't camp an exact
starter slot ahead of a better-ECR player drafted later — the better player
wins the exact slot and the keeper gets pushed to FLEX/bench instead.

**Queue**: check "Q" next to any player in Best Available to add them to
"My Queue" — a shortlist of upcoming targets, shown in ADP order with a
one-click draft action. A queued player disappears from the queue once
they're drafted (by you or a rival) and reappears automatically on undo,
since the queue is a live filter over the pool's `drafted` flag rather than
a one-time removal — nothing to manually re-add after backing up a pick.
Persists via `/api/setup` alongside keepers/trades/tendencies.

**Tiers**: Best Available shows a tier separator row (`Tier 3 · 7 left`) from
the players CSV's `tier` column, and the count turns red at 3 or fewer left.
Counts are computed over the *filtered* rows, so with the position filter on
"RB" the break reads "7 left at RB" — the scarcity question you actually ask
on the clock. Breaks only fire when crossing into a deeper tier: the pool is
ADP-sorted while tiers come from ECR, so reacting to every tier change would
litter the list with headers; a better-tier player who's slipped down the ADP
board just renders inline under the tier he fell into. `parsePlayers()` now
keeps `tier`, and `poolToCSV()` exports it, so a load/export round-trip
doesn't silently drop the column.

**Headshots & rookie badge**: Best Available, the auction pool table, drafted
picks on the board, and My Picks all show a player's headshot (a 20px circular
`img`) and, where applicable, an `RK` badge. Both are sourced from Sleeper's
free public player list (`api.sleeper.app/v1/players/nfl`), matched into
`players-2026.csv` by normalized name at data-pull time — two optional CSV
columns, `sleeper_id` and `rookie` (`years_exp===0` when pulled). Headshots
hotlink `sleepercdn.com/content/nfl/players/<sleeper_id>.jpg` directly — no
image storage, no ongoing crosswalk to maintain — and `onerror` hides a
missing image rather than showing a broken-image icon, since coverage isn't
guaranteed for every player. `parsePlayers()`/`poolToCSV()` round-trip both
columns like every other optional field.

**Runs & scarcity cues**: a strip under the draft controls (`#clockCues`)
answers "what's happened since I last picked, and what won't survive to my
next pick" — (1) positional counts of everything drafted since your most
recent pick ("Since your last pick (9): RB 4 · WR 3 · QB 1"), (2) the top
tier still on the board at each of QB/RB/WR/TE with its remaining count,
reddening at 3 or fewer (best remaining *tier*, not best ADP — a tier-2
player who's slipped down the ADP board is still tier 2), and (3) how many
available players have an ADP ahead of your pick *after* the one on the
clock, with the first three named (★ marks queued players). Re-rendered with
every pick, undo, and rewind.

**Rewind to any pick**: clicking any non-keeper cell on the board — or the
`↩` on a filled row of "My picks" — rewinds the draft to that pick after a
confirm, dropping it and everything after it and putting the clock back
there (`rewindTo(ov)`). Keepers are pre-placed and never rewound. This is
the branch-testing tool: re-run a mock down a different path from round 3
without resetting the whole draft. Single-step `undo()` still exists.

**Draft analysis**: a card at the bottom of the Draft Room, run on demand via
"Grade the draft as it stands" — works mid-draft, not just at the end. It
ranks all 12 teams by roster value with a letter grade, starter slots filled,
and per-position ranks (QB/RB/WR/TE), highlighting your row; then lists the
five biggest steals and five biggest reaches by `ADP − overall pick`.

Value is ECR-based, not projection-based: `proj` is only populated for the
players FantasyPros exposes without a login, so grading on it would score
half the board as zero. The curve (`valuePoints`) is steep at the top and
flattens out, so one stud outweighs two mid-round starters. Team value =
starters + 30% of the bench (depth counts, but far less). Grades are relative
to that draft's own field: a z-score against the 12-team mean/σ mapped to
A+ … F, so grades describe *this* draft rather than an absolute standard.
Steals/reaches exclude K and DST — everyone waits on them by convention, so
they "fall" 20+ spots past ADP in every draft and would crowd out the real
ones. Auction leagues show a placeholder here like the rest of the room.

### Auction valuation

**The market curve is calibrated against this league's own realized prices, not
invented.** The 106 declared keepers are real winning bids (plus the league's
$1/yr escalation) from the same 14 managers, budget and format — the best
available ground truth. Their distribution: max $64 (32% of a $200 budget),
median $6, 25.5% of kept players at $1-2.

Price decays with ADP as a **stretched exponential**,
`exp(-(rank/auctionDecay)^auctionShape)`. The second parameter matters: a plain
exponential has one knob, and one knob cannot produce both a sharp peak and a
fat middle. Fitting AEOK's median with a single knob forced its top player to
$43 when that league's own history says $58. Both parameters are fitted per
league against its own realized prices, because the two leagues are genuinely
different markets — Fantastic peaks at $64 with a median of $6 and 25% of the
roster at $1-2, while AEOK peaks at $58 with a median of $8 and only 11% at
$1-2, since superflex with 18 roster spots spreads money across more genuinely
rosterable players and leaves far less $1-2 filler.

| league | decay | shape | fitted max / median / $1-2 | observed |
|---|---|---|---|---|
| Fantastic | 42 | 0.90 | $66 / $6 / 26.3% | $64 / $6 / 25.5% |
| AEOK | 34 | 0.70 | $53 / $7 / 9.3% | $58 / $8 / 11.0% |

A league with no fit falls back to decay 50, shape 1 (plain exponential).

**Prices are value over replacement, not raw rank.** The curve above sets the
*shape*, but a rank curve alone has no idea that a league only rosters so many
players at a position: in a one-QB league the 25th quarterback still looked like
the ~150th player overall and drew real money, which nobody would ever bid.
Every price is therefore the player's curve weight **minus the curve weight of
the last rosterable player at his position**, floored at zero — so everything at
or past replacement is worth exactly the minimum bid, and the tier just above it
compresses into $1-3 instead of tapering gently through a fat $4-9 middle.

Replacement level comes from the league's own settings, not a tuning knob
(`auctionRosterDemand`): `teams x starters` at each position, plus flex slots
split RB .42 / WR .46 / TE .12 among the flex-eligible positions, plus superflex
slots going 85% to quarterbacks, plus every bench spot divided among QB/RB/WR/TE
(a superflex league leans more of it to QB). Kickers and defenses get exactly one
per team — nobody benches them. For Fantastic that is 26 QB / 76 RB / 82 WR /
26 TE / 14 DST, which sums to the league's 224 roster spots.

The effect on Fantastic: Cam Ward, Jacoby Brissett, Tre' Harris and Colby
Parkinson all price at $1; Emmett Johnson and Jaydon Blue at $2; the $4-9 band
fell from 46 players to 21. Money is conserved, so the top tier rises slightly
and the ceiling does more of the work than before.

### Auction scarcity tiers (green / yellow / red)

The auction room's per-position "how many left" strip reads **top tier / still
rosterable / past replacement**. The boundaries are read off the remaining pool
rather than set at fixed dollar amounts — deliberately, because a $29 player
sitting next to a cluster of $30s belongs with them, not with the $4-16 group
below (`auctionPosTiers`):

- **red** — past this position's replacement level once everyone already
  rostered there is subtracted. The literal waiver-wire tail.
- **green** — above the single biggest price drop in the *top half* of what
  remains. Only the top half is searched, because the largest raw drop across
  the whole list is almost always the $2 -> $1 step at the very bottom, which
  says nothing about who the premium players are.
- **yellow** — everything in between.

Because it re-reads the live pool on every render, green narrows on its own as
the elite tier is bought, until eventually one player is green by himself. As of
the current Fantastic board, green at RB is exactly the Bijan / Barkley / Jeanty
/ Achane / Walker / Jacobs / Love / Hall tier, and green at QB is Dak alone.

The historical note: the decay constant (`auctionDecay`, default 50) was first
fit alone to reproduce Fantastic's distribution. In a full 14-team/$200
auction it yields max $59, median $6, and 25.9% at $1-2 — three of four
observed metrics within noise. The original value of 35 was far too
concentrated: it put the top player at $81 in a *full* auction, 46% of the
roster at $1-2, and after rescaling to a keeper-thinned pool produced $119 for
the top available player, which no manager would ever bid.

`auctionMaxPriceShare` caps any single player at a share of the budget, set per
league from its own history: Fantastic 0.36 ($72, above its realized 32% to
allow for a thinned elite tier), AEOK 0.32 ($64, just above its realized 29%).

The cap is a **soft knee, not a clip**, and is applied exactly once. Clipping
put four different players at exactly $72 — it enforced the ceiling but
destroyed the ordering among precisely the players a bid decision turns on.
`softCeiling()` is monotonic, so values above the knee compress smoothly toward
the cap while staying ranked and distinct. It must not be iterated: squash →
redistribute → squash pushes each redistribution back over the knee and
converges the whole top tier onto one number (seven players at $58 in testing).
Freed dollars go once to players below the knee, who can absorb them without
needing to be squashed in turn. The league's realized ceiling is 32%; 40% leaves headroom for genuine
keeper-driven inflation while ruling out runaway values. Clipped dollars are
redistributed across the rest of the pool (`applyAuctionCap`), never destroyed,
so the priced pool still sums to the money that actually has to be spent.

**Scarcity, not budget, drives the keeper-league premium** — worth knowing
because the intuition runs the other way. Fantastic has $1,346 left over 118
slots, $11.40 per slot, slightly *less* than a full auction's $12.50. Prices at
the top are nonetheless higher than a full auction's because five of the top ten
players are kept, so whoever is best available absorbs a much larger share of
the curve. AEOK demonstrates the same mechanic in reverse: $8.10 per slot, well
under normal, and its prices sit below the ceiling without it ever binding.

Rescaling to *remaining* money is deliberate and correct: those dollars do get
spent, and a keeper league that locks up half its cash genuinely inflates
what's left. In this league 52% of all money is committed to keepers, so
elite players still on the board legitimately cost more than they would in a
normal draft — the fix was the shape and the ceiling, not the inflation.

**Target $ prices retention, which is what makes a keeper auction different.**
The price you pay is also next year's cost basis (keeping costs price +
`annualIncrease`), so overpaying doesn't merely cost money now — it destroys
the retention value that made a young player worth chasing. The real case this
models: a receiver bought at $23 when $18 was the number, whose $24 keeper
price then exceeded his worth, turning a multi-year asset into a one-year
rental.

`keeperBreakEvenBid()` solves for the highest price at which he still returns
value, over a horizon of `keeperHorizon` future seasons (default 3 for
unlimited-keeper leagues; at horizon 1 the premium is a rounding error and
doesn't reflect how these actually get bid up):

```
P = V + Σ(k=1..H) max(0, V·traj^k − (P + k·increase))
```

solved as a damped fixed point. The `max(0, …)` is the cliff: past the price
where next year's cost exceeds his value, the retention premium is simply gone
and the target stops rising. Note the asymmetry — an aging player isn't
penalized below his one-year value, because a rental is still worth what he
produces; the differentiation is that ascending players earn a premium.

`traj` is the year-over-year value trend. An explicit `trajectory` CSV column
wins; otherwise it's inferred from `age` via conventional positional aging
curves (`AGE_PEAK` — RB 25, WR 27, TE 28, QB 30; running backs decay fastest),
capped so age nudges rather than dominates; otherwise neutral. With real ages
attached this separates a 21-year-old from a 28-year-old at the same market
price, which is the whole point.

**Both layers fall back to the same curve when no source data is loaded**, so
Market $ and Target $ will read identically until either valuation columns
(`fp_value`, `custom_value`, …) or `age`/`trajectory` are populated. That's
honest rather than a manufactured difference, and the auction pool count is
labeled "est." to say so.

**Transferable to other sports.** The method here — calibrate the curve against
the league's own realized prices, cap by observed share of budget, and price
retention as a break-even bid over a keeper horizon — is sport-agnostic. Only
the inputs change: positional aging peaks (`AGE_PEAK`), position multipliers in
`auctionWeight()`, roster shape, and the decay constant, all of which are
per-league settings rather than code. Basketball auctions are the next
application (see FEEDBACK.md, 2026-08-31).

**Auction price layers**: auction leagues deliberately maintain two dollar concepts. **Market $** models what opponents are likely to pay; Yahoo league-specific default/Pre-Draft Value and Yahoo Average Salary are the preferred anchors when loaded, with market-source fallbacks. **Target $** is Hovo's independent bid ceiling/value layer and does not inherit Yahoo by default; it can blend FantasyPros, Draft Sharks, RotoWire, and the future custom league-aware valuation. Both are dynamically rescaled to the actual money and open roster slots remaining after projected/confirmed keepers and auction sales. If source columns are absent, each layer falls back to the existing rank/scarcity curve and is visibly labeled as an estimate. Supported optional player-CSV columns: `yahoo_default`, `yahoo_avg_salary`, `fp_value`, `ds_market`, `ds_value`, `rotowire_value`, `custom_value`.
### Teams & Keepers
Rival roster view and keeper assignment/modeling across the league, plus
the owner-tendency controls (see Opponent model below). For dollar-cost
auction keeper leagues, every rostered player's keeper cost is shown and
keepers can be toggled for every team. The UI enforces the auction budget and
minimum-dollar reserve for each open draftable roster slot, and shows each
team's selected keeper spend, money left, and maximum legal bid. Rival keepers
can be auto-projected as a starting scenario and then manually adjusted; the
user's own keeper selections are never cleared by "clear rival keepers."

**Which pick pays for a keeper.** The cost round says what a keeper is *worth*,
not which pick pays for him — with trades in play a team can hold several picks
in one round or none at all. So each keeper is placed on a pick its team
**currently owns**: the least valuable (latest) one available in the cost
round, each keeper consuming a distinct pick so two keepers in the same round
can't collide. If the cost round is exhausted, it falls back to *earlier*
rounds — a 10th-round cost is paid with a 9th, then an 8th, and so on. Never
later, which would underpay. A keeper whose team has traded away every pick at
or before the cost round can't legally be kept, and is flagged with a ⚠ rather
than silently vanishing off the board.

**Unknown values read as "—", not as a number.** `adpRoundOf()` returns `null`
for a player who isn't in the pool, and `keepValue()` propagates it. Previously
a missing player fell through to a `99` sentinel, so a keeper costing a 10th
displayed as `−89` — indistinguishable from a genuinely terrible keeper, and
the cause of a real bug where a misspelled name made a `+2` bargain look like a
disaster. Sorting places unknowns last rather than coercing them to 0, and
auto-assign won't rank an unrated player against a rated one.

Hand-entered rosters drift from the pool's spelling, and a mismatch silently
breaks keeper valuation. `NAME_ALIASES` bridges verified misspellings (each
checked against the pool before being added) so they resolve regardless of
which data source supplied the roster — the authoritative copy lives in KV per
league, so correcting the file alone wouldn't fix live data. Saved keeper
selections in `assigned` store the name as spelled when it was picked, so
`keeperCostFor()` resolves through the same alias/normalisation: without it,
correcting a roster spelling would orphan the saved selection and drop the
keeper with no visible error.

`findPlayer()` matches exactly, then on a normalized form (case, punctuation,
Jr/Sr/III suffixes), then — for DEF/DST only — on a name suffix, because
rosters carry defenses by nickname ("Broncos") while the player pool carries
full names ("Denver Broncos").

### Trades
**Pick trades work on current ownership, not original ownership.** You choose
the manager giving up the pick, then choose from the picks that manager
*actually holds right now* — including ones they acquired in an earlier trade,
tagged "via <original owner>" — then the manager receiving it. This is what
makes re-trading possible: previously the form took a round and computed the
`from` manager's own original pick in it, so an acquired pick could never be
moved on, and choosing a round whose pick had already been traded silently
moved the wrong pick. Trading a pick back to whoever originally owned it clears
the override instead of recording a redundant one.

Reassign a draft pick to another manager, or move a player/keeper
to a different roster — both change who's on the clock, who owns which
pick, and keeper eligibility. Saved to the cloud (`/api/setup`) alongside
keepers so trades only need entering once. Includes a "backup history"
panel that lists the last 30 auto-saved snapshots of this league's
keepers/trades/tendencies/picks with one-click restore, for when something
gets overwritten by mistake.

### Mocks
Cloud-saved mock draft history (KV-backed via `/api/mocks`), synced across
devices. Save the current draft, list saved mocks newest-first, load or
delete one. Snake/linear mocks persist pick state; auction mocks persist
winning team + price for every completed sale. Falls back to local-only
("Save config" in the Data tab) when the cloud API isn't reachable.

### Strategy Lab
Compares draft paths/strategies side by side (`renderStratCards`). Rival picks
here use the same opponent model as the Draft Room, so Lab results and live
mocks don't diverge. Not available for auction-type leagues yet.

### Data
Player pool view (ADP/ECR/projection) and keeper list, plus config
export/import (JSON) as an offline backup independent of the cloud Mocks
feature. Also has a button to save the pasted player-pool CSV directly onto
the active league's cloud profile (see "League profiles").

**Keeper cost/value**: a dedicated table, every currently-kept player
league-wide with owner, position, cost round, ADP round, and surplus value
(cost round − ADP round; positive = a bargain, negative = an overpay),
sorted best value first — the same `keepValue()` math Teams & Keepers shows
inline per-team, surfaced as its own cross-league view. Only shown for
classic round-cost keeper leagues (`leagueType==='keeper' &&
keeperCostType==='round'`) — not meaningful for dynasty (no cost round),
dollar-cost auction keepers, or redraft/guillotine/bestball (no keepers).

### Commish
Per-league membership tracking, separate from the fantasy-roster concerns
of Teams & Keepers: one row per owner — returning next year (yes/no/
unsure), dues owed and paid (in dollars), contact info, and free-text notes.
Auto-saves to the cloud (`GET/PUT /api/commish`), scoped per league like
everything else, with the same rolling 30-snapshot backup pattern as
`/api/setup`/`/api/leagues` (`GET/POST /api/commish/history|restore`; its
own KV entity, `commish:<league>`, kept separate from `/api/setup` on
purpose so a keeper/trade backup or restore never touches membership data
and vice versa) — the API exists but there's no restore panel in the
Commish tab UI yet, unlike Trades'/Leagues'. Hidden entirely in guest mode.

### Leagues
Create, edit, or delete league profiles — see "League profiles" below.

## Opponent model

How simulated rivals pick, used by both the Draft Room and the Strategy Lab.

Each rival scores a consideration set (the top 40 available by ADP — nobody
scans the whole board) and takes the highest scorer:

```
score = −ADP                       // ADP is the backbone
      + 26 × needScore(pos)        // roster need
      −  8 × biasFor(owner, pos)   // per-owner tendency, if enabled
      − 90 if K/DST before round 14
      ± noise-slider jitter
```

**`needScore`** answers "how badly does this team need another of this
position?" — `1` while a starting slot is unfilled, `0.6` if it can still fill
FLEX, `0.15` for ordinary bench depth, and `−1` once the team is at its depth
cap (starters + 3 for RB/WR, starters + 1 for everyone else).

A position at its depth cap is **vetoed outright**, not merely penalized, so
no tendency bias — however strong — makes a team stockpile a 4th QB. The veto
falls back to the full candidate list only when every option is capped, which
is what produces plausible scavenging in the final rounds.

### Owner tendencies

Draft Wizard's Draft Intel mines 5 years of synced league history. We don't
need that: it's the same 12 owners every year and their habits are known, so
tendencies are hand-set instead. On **Teams & Keepers**, each rival owner has
an enable checkbox and a bias per position (QB/RB/WR/TE, range −3 to +3;
positive = reaches, negative = fades). Unchecked owners draft on value and
roster need alone. Biases persist in saved config and in exported JSON.

## Draft order

Part of each league's profile (`ownerSlot`, e.g.
`{Robert:1,Edward:2,...,Hovo:6,...}`) — editable from the **Leagues** tab's
owner/slot editor, no code change or redeploy needed. See "League profiles".

## League profiles

The app serves multiple leagues from one deployment. A league profile bundles
everything that used to be hardcoded — team count, **rounds** (starters +
bench combined; there's no separate bench-count field, since bench is
whatever's left over after starters are filled — see `slotRosterPlayers`),
scoring label, draft type
(snake/linear/auction — linear keeps the same team order every round, no
snaking; the draft engine only needs `overall()`/`slotForOverall()`/
`posInRound()` to know the difference, so trades/board/Strategy Lab all work
unchanged), superflex flag, starting lineup + flex eligibility, max
keepers, keeper-cost type (round/dollar), draft/keeper dates, owners, draft
order (`ownerSlot`, which for an auction league is nomination order — who
nominates first, not a snake-draft position), locked/known keepers, the
roster data (`rostersRaw`, pipe-delimited `owner|player|drafted_round|
keeper_round`), and the player pool CSV (`playersCsv`).

**`leagueKeepers`** (auction leagues): an array of `"Owner|Player"` for
keepers the *league itself* has locked in — a passed deadline, identical for
every viewer, so it lives on the shared profile rather than in a signed-in
user's personal `assigned` set. `rebuildKeepers()` folds both together
(league-declared first, then personal, deduped by owner+player) and derives
each keeper's dollar cost from `rostersRaw`'s 4th field rather than storing it
twice. `resetDraft()` marks every one drafted so it leaves the auction pool,
and `auctionTeamState()` sums them into each team's committed spend, open
roster slots, money left, and max bid — no separate plumbing needed once the
keepers exist. On Teams & Keepers a league-locked keeper renders checked,
disabled, and chipped **LOCKED**, since it's a fact rather than a choice.

**Cloud profiles never get newer code defaults for free.** Once a built-in
league is first seeded to KV (`fetchCloudLeagues()`), the cloud copy is
authoritative forever — a real edit in the Leagues tab must never be
overwritten by a later code change, so nothing in the code's `LEAGUES_DEFAULT`
is pushed to an already-seeded profile. That's the right default, but it has
one consequence worth knowing: a field added to a built-in profile's defaults
*after* it was first seeded (like `leagueKeepers`) will never reach the live
cloud copy on its own. `fetchCloudLeagues()` runs one narrowly-scoped backfill
for exactly this: if a cloud profile's `leagueKeepers` is empty/missing but
the code default has a real one, it merges the default in and writes the
merged profile back — once, and only for that one field, so a genuine edit
(including an intentionally-cleared list, if that ever becomes editable) is
never at risk.

**League type** (`leagueType`, separate from `draftType`): `keeper` (default)
— today's model, pick up to `maxKeepers` at a per-player cost round, opt-in
via checkboxes on Teams & Keepers. `redraft` — no keepers at all; the keeper
UI on Teams & Keepers is hidden. `dynasty` — the opposite of opt-in: every
rostered player is assumed kept with no cost round, shown pre-checked on
Teams & Keepers, and unchecking one cuts them back to the draft pool
(tracked in `cutPlayers`, separate from classic keepers' `assigned`). Dynasty
keepers don't occupy a slot on the draft board the way classic keepers do —
there's no "cost round" to place them at — so they're excluded from the
incoming draft's `picks[]`/board entirely and merged back in for display by
`rosterOf()` reading the roster data directly. This matters for the two
Sleeper-imported dynasty leagues and MFL-imported leagues like "NCAA Power 5
Football" (dynasty) vs. "NFL Promotion & Relegation" (redraft).
`guillotine` and `bestball` also exist as selectable values, currently
treated identically to `redraft` (no keeper concept) — they're categorized
so those leagues can exist and run ordinary mock drafts, but what should
actually differentiate them (how players get ranked/valued for that format)
needs the league-aware custom rankings/projections engine, which isn't
built yet (see `FEEDBACK.md`).

Profiles live in KV (`league:<id>`), fetched via `GET /api/leagues` on boot.
The **Leagues** tab is full CRUD: create a new league, edit any field on an
existing one (including pasting in roster/player CSVs), or delete a league
(refused for `aeo-keepers` — the one with real, currently-in-use data). A
header dropdown switches the active league; `/api/*` routes take a `?league=`
param so setup/trades/mocks/backups are all scoped per league. AEO-Keepers'
hardcoded values remain in the code as an offline/first-run fallback (this
app still works if the API is unreachable, or the very first time it's ever
booted against an empty KV store) but the cloud copy is authoritative once
it exists.

**Backup history**: every save to a league profile keeps a rolling 30-snapshot
history (`GET/POST /api/leagues/:id/history|restore`), restorable from a
panel in the Leagues tab — the same pattern `/api/setup` already had for
keepers/trades. This exists because an import can otherwise silently
overwrite the wrong league (see FEEDBACK.md, 2026-08-24 incident): **Sleeper
import always targets a new league**, never whatever league happens to be
selected in the form — `editingLeagueId` is explicitly cleared before an
import runs, so Save can only create, never silently overwrite.

**Sleeper import**: paste a public Sleeper league ID into the Leagues tab to
pull that league's owners and current rosters into the edit form for review.
Sleeper doesn't expose ADP/ECR/projections or a reliable draft-type/superflex
flag, so those aren't guessed — only owners/rosters get pre-filled, and
nothing saves until you review the form and click Save, same as manual entry.

**MFL import**: same idea, for MyFantasyLeague.com — paste a league ID (and
year, defaults to the current one) to pull owners/rosters via MFL's public
export API (no OAuth needed). MFL doesn't expose ADP/ECR/projections, a
draft-type/superflex flag, or a keeper flag either, so imported rosters land
as FA/NONE for you to set on Teams & Keepers after saving — same
review-before-save policy as Sleeper import.

**Divisioned/conference leagues**: some MFL leagues run several
independently-drafted divisions or conferences under one umbrella (an
English-football-style promotion/relegation league with Premier
League/Championship/League One divisions; a big multi-conference dynasty
with SEC/ACC/Big Ten-style conferences). Each division shares the same NFL
player pool but only has unique rosters *within* itself — the same real
player can legitimately be owned by one team in every division. Importing
all divisions at once would collide under this app's name-keyed roster
model, so when `GET /api/import/mfl/:id` detects more than one
division/conference it returns a picker (`needsDivision`, a `divisions`
list) instead of guessing; the Leagues tab shows a dropdown for it.
Re-requesting with `&division=<id>` imports just that division's teams as
an ordinary league profile, same as any non-divisioned league from there
on — no separate in-app "conference" concept, no promotion/relegation
movement between seasons modeled (that's a future season's problem, not
this one's).


## Cross-league retention, IR, and auction-keeper rules

These are domain rules for the league-aware rankings/keeper engine, separate from the existing draft-room mechanics.

### League-type semantics

- **Redraft**: no player-retention element across seasons; the player pool is effectively a fresh start for the incoming draft. Draft capital/budget usually resets as well, but that is not required by the definition.
- **Dynasty**: retained players have no explicit keeper price beyond using a roster slot. A dynasty league may still cap the roster/number retained; the defining point is that keeping a player does not consume a draft round, auction dollars, or another retention-specific resource.
- **Keeper**: retaining a player consumes an explicit resource beyond the roster slot (draft pick/round, auction budget, etc.). The keeper count may be capped or effectively unlimited; the cost, not the number retained, is the main distinction from dynasty for this system.

### IR-aware draft value

IR capacity changes **ranking/decision value**, not the player's underlying projection. The league-aware rankings engine should therefore apply an IR-capacity modifier to injury-risk and currently-injured profiles:

- **0 IR**: strongest downgrade; avoid carrying injury risk when possible because every unavailable player consumes a normal roster slot.
- **1 IR**: injury remains a meaningful negative, but the roster can absorb one unavailable player.
- **2+ IR**: tolerate more injury risk and lean further into discounted injured players than in a baseline league.

This is intentionally a value/ranking overlay. Do not inflate projected games, points, efficiency, or other player-level projections because a league has more IR slots.

### Fantastic Keeper Auction — confirmed 2026 profile

- Yahoo league **835427**, 14 teams, full-PPR H2H, 6-point passing TDs.
- **16 draftable roster spots + 2 IR**. The IR spots do **not** count against preseason keeper/budget accounting. Starting lineup: QB, 2 WR, 2 RB, TE, 2 W/R/T, DEF; 7 bench.
- **$200 auction budget**; effectively unlimited keepers subject to the 16 draftable slots and budget.
- Every unfilled draftable roster slot must reserve at least **$1**. Example: 5 keepers costing $60 leave $140 for 11 open slots, so the maximum legal first bid is $130.
- Keeper salary is **prior auction/acquisition price + $1**. A kept salary becomes the next year's assumed prior price, so the player escalates another $1 each year.
- Drafted-player cost provenance survives trades, drops, waivers, and reacquisition; those transactions do **not** reset cost.
- An undrafted/free-agent player has a **$1 prior price**, so the first keeper salary is **$2**.
- Keeper deadline: **Sunday, August 30, 2026 at 12:00am PDT** (the Saturday-night boundary). Yahoo lists this league's draft as Offline Draft; the exact offline draft date/time remains external/unconfirmed.
- 2026 authoritative keeper-eligible roster/cost source: Google Sheet **Fantastic Football Auction Keeper League Tracker 2026**. Those costs were manually reconstructed from 2025 end-of-season rosters plus 2025 auction results and already include the +$1 escalation. Draft Lab should consume the calculated 2026 costs rather than re-derive 2025 history this season.

### AEOK Auction League — confirmed 2026 profile

- Yahoo league **868349**, 12 teams, full-PPR H2H, **Superflex**, Live Salary Cap Draft.
- Draft: **Tuesday, September 8, 2026 at 9:00pm PDT**; $200 budget; 30-second nomination / 20-second bid timers. Keeper deadline: **Tuesday, September 8, 2026 at 12:00am PDT**.
- **18 draftable roster spots + 2 IR**. Starting lineup: QB, 2 WR, 2 RB, TE, 2 W/R/T, Q/W/R/T; 9 bench. No K/DEF slot.
- Uses the same $200-budget, $1-per-open-slot reserve, effectively unlimited keeper count, annual **prior price + $1** escalation, and persistent drafted-player cost provenance as Fantastic.
- Special case: an **undrafted QB** has a $5 assumed prior price and therefore costs **$6** to keep the first time. Other undrafted players use the normal $1 → $2 rule.
- Scoring includes 4-point pass TDs, -1 INT, +2 at 350 passing yards, +2 at 100 rushing/receiving yards, +2 for 40+ yard completions/runs/receptions, and 0.5 per rushing first down.
- 2026 authoritative keeper-eligible roster/cost source: Google Sheet **AEOK Auction League Tracker 2026**. Use the individual manager-tab calculated costs: its hidden consolidated `Rosters` tab preserves raw $2 entries for some undrafted QBs, while the manager tabs correctly apply the league's $6 QB keeper rule.

## Target feature set (Draft Wizard baseline)

FantasyPros' **Draft Wizard** is the agreed working baseline for where this
app is headed — the look, feel, and capability bar. This is not a clone: it
stays custom to this 12-team keeper league (real owner names, real rosters,
our keeper rules). Researched 2026-08-20; individual items are tracked as 🆕
entries in `FEEDBACK.md`.

### What Draft Wizard does, and where we stand

| Draft Wizard capability | What it does | Our status |
|---|---|---|
| **Mock Draft Simulator** | Fast mocks vs simulated opponents, no waiting between picks | ✅ Have it — Draft Room |
| **Keeper support** | Enter keepers per team with the round each costs; mocks account for them | ✅ Have it, and ours is more specific (real rosters + locked keepers) |
| **Opponent pick logic** | Weighs rankings + team needs + positional scarcity; Basic vs Advanced modes | ✅ Have it — need-aware scoring with hard depth-cap vetoes (see "Opponent model") |
| **Draft Intel** | Analyzes leaguemates' past drafts for tendencies; toggle per team into mocks | ✅ Have it — hand-set per-owner tendencies, toggled per owner (same 12 guys yearly, so no mining needed) |
| **Player queue** | Shortlist of targets, surfaced when you're on the clock | ✅ Have it — "Q" column + My Queue |
| **Tiers** | Tier breaks in rankings + "players left in tier" counter that reddens | ✅ Have it — filter-aware tier breaks in Best Available |
| **Draft Analyzer** | Post-draft grade, projected standings, positional ranks, strengths/weaknesses, steals & reaches | ✅ Have it — Draft analysis card (grades, positional ranks, steals/reaches). No projected standings — we grade roster value, not simulate a season |
| **Redo / restart from any pick** | Branch a mock from an earlier point to test alternatives | ✅ Have it — `rewindTo()` from any board cell or my-picks row |
| **Cheat Sheet Creator** | Import/blend rankings from any source, drag-drop reorder, custom tiers | ⚠️ Partial — Data tab imports a CSV; no reordering or blending UI |
| **Strategy comparison** | — (not a distinct DW tool) | ✅ Ours already exceeds this — Strategy Lab compares draft paths over N sims |

### Design direction

Draft Wizard's during-draft screen is dense and information-forward: best
available on the left with per-player value context, your roster and needs
alongside, the board underneath, and always-visible "what should I do right
now" guidance. Our Draft Room is already shaped this way — the gap is mostly
in the *decision support* (tiers, queue, scarcity/run signals, need-aware
opponents) and the *after-action review* (grade, steals/reaches, projected
finish), not in the overall layout. As of 2026-08-26 that gap is mostly
closed — tiers, queue, run/scarcity cues, need-aware opponents, rewind, and
draft grading all ship; what's left of it is a simulated projected finish,
which we deliberately don't do (we grade roster value instead).

### Deliberately out of scope

- Live-draft sync with Yahoo/ESPN/Sleeper (Draft Assistant's real-time
  tracking) — this league doesn't draft on a synced platform. (Sleeper is
  used for a one-time, review-before-save structure import — see "League
  profiles" — not live sync.)
- Advanced auction realism beyond the current MVP — exact nomination-order
  strategy, live bid-timer behavior, price-enforcement against a real Yahoo
  room, and calibrated custom auction values still depend on future ranking /
  projection / live-draft work. The core salary-cap mock room itself is built.
- Accounts, subscriptions, tiers of access — personal tool.

## Guest mode

`?guest=1` on the app URL gives a read-only, single-league, Draft-Room-only
view for sharing with someone who shouldn't see (or touch) anything else —
locked to AEO-Keepers, every other nav tab hidden, and their `<section>`s
removed from the DOM entirely at boot rather than just CSS-hidden, so
inspecting the page doesn't leak trades/keepers/other leagues either. Picks,
undo, and the queue all still work locally for a live demo feel, but
`saveSetup()` is a no-op in guest mode so nothing a guest does ever reaches
the cloud or touches the real setup data. This is a UI-level restriction, not
a real auth boundary — someone hitting the API directly from devtools isn't
blocked — which is an accepted tradeoff for "show a friend," not a security
posture for a hostile viewer.

## Accounts (Google sign-in)

Identity comes from Google OAuth. There are no passwords stored here to leak
or reset, and no signup form — signing in with a Google account *is* creating
the account.

**The first Google account that ever signs in becomes the admin.** Everyone
after that is a regular user. Re-signing in refreshes your name/avatar but
never re-grants admin, so the role can't be taken by signing in again later.

Three tiers, enforced on the server (`worker.js`) and mirrored in the UI:

| | Tabs | Data |
|---|---|---|
| **Admin** | all eight | keeps the original unprefixed KV keys — the owner's existing keepers/trades/picks/mocks carry over untouched |
| **Signed in** | Draft Room, Teams & Keepers, Trades, Mocks, Strategy Lab | own private setup + mocks under `:u:<id>` keys; reads shared league profiles, can't edit them |
| **Signed out** | Draft Room only, nothing saves | none — same view a `?guest=1` link gives |

Commish, Leagues, and Data are admin-only: the first is league administration
(dues, contact info), and the other two edit *shared* league structure — the
owner list, draft order, and player pool everyone else drafts against. So are
the Sleeper/MFL/Yahoo imports, since they feed league-profile edits, and the
Yahoo connect handshake, since there's one shared Yahoo grant slot.

The admin keeping the legacy unprefixed keys is the same trick `aeo-keepers`
already uses to keep its pre-multi-league data (see `leagueId()` in
`worker.js`): it means turning accounts on requires no migration and can't
strand the owner's existing draft prep.

Mechanically: `/auth/google/start` redirects to Google's consent screen with a
random `state` echoed through a short-lived cookie (CSRF on login);
`/auth/google/callback` exchanges the code server-to-server, reads the
`id_token` payload for the Google subject id, upserts a `user:<sub>` record,
and sets an HttpOnly/Secure/SameSite=Lax session cookie signed with HMAC-SHA256
(30 days). The `id_token`'s signature isn't separately verified because it
arrives directly from Google's token endpoint over TLS in a call we initiated —
verification matters for tokens handed over by a client, which this isn't.
`/api/me` reports `{accountsEnabled, signedIn, admin, user}` and is the one
route answerable while signed out; `/auth/signout` clears the cookie.

**Dormant until configured.** With no `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
secrets set, `ACCOUNTS_ON` is false, every caller is treated as the owner, and
the app behaves exactly as it did before accounts existed. That's a deployment
prerequisite — you can't run OAuth without an OAuth app — not a security
stance, and the header says so out loud ("⚠ Accounts off — everyone has full
access") rather than looking like a login that isn't one. To turn it on:

1. Create an OAuth client at https://console.cloud.google.com/apis/credentials
   (type: Web application), with the authorized redirect URI
   `https://aeo-draft-lab.hkeseyan.workers.dev/auth/google/callback`.
2. `npx wrangler secret put GOOGLE_CLIENT_ID` and
   `npx wrangler secret put GOOGLE_CLIENT_SECRET`.
   Optionally `npx wrangler secret put SESSION_SECRET` (any long random string);
   `GOOGLE_CLIENT_SECRET` is used for cookie signing if it's absent.
3. Sign in first, before sharing the URL — whoever signs in first is admin.

## Deployment

See `CLAUDE.md` for the Worker/KV architecture — not a feature spec concern,
kept there to avoid duplication.

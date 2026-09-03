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

The board is a genuine CSS grid (`grid-template-columns` set per league's
team count, every header/cell a direct grid child in row-major order) so a
row's height is shared across every column — a wrapped long name doesn't
push just its own column out of alignment with its neighbors, which a
per-column block-stacked layout couldn't guarantee. Column headers and
traded-pick tags show the real owner name (`ownerLabel(slot)`, falling back
to `T<slot>` only if a slot genuinely has no owner name), not a bare `T1`/
`T2`/`→T4`.

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

**Auction price layers**: auction leagues deliberately maintain two dollar concepts. **Market $** models what opponents are likely to pay; Yahoo league-specific default/Pre-Draft Value and Yahoo Average Salary are the preferred anchors when loaded, with market-source fallbacks. **Target $** is Hovo's independent bid ceiling/value layer and does not inherit Yahoo by default; it can blend FantasyPros, Draft Sharks, RotoWire, and the future custom league-aware valuation. Both are dynamically rescaled to the actual money and open roster slots remaining after projected/confirmed keepers and auction sales. If source columns are absent, each layer falls back to the existing rank/scarcity curve and is visibly labeled as an estimate. Supported optional player-CSV columns: `yahoo_default`, `yahoo_avg_salary`, `fp_value`, `ds_market`, `ds_value`, `rotowire_value`, `custom_value`.

The 2026 embedded inputs are league-specific: Yahoo League Value/Average Salary were captured independently for each Yahoo league, while FantasyPros was calculated as 14 teams/$200/16 slots/2 flex for Fantastic and 12 teams/$200/18 slots/2 flex/1 superflex for AEOK. FantasyPros Custom Scoring is not available on the authenticated account, so the FantasyPros component uses default full PPR rather than claiming exact support for Fantastic's 6-point passing TDs or AEOK's bonuses. RotoWire values are absent rather than estimated without access.

### Teams & Keepers
Rival roster view and keeper assignment/modeling across the league, plus
the owner-tendency controls (see Opponent model below). For dollar-cost
auction keeper leagues, every rostered player's keeper cost is shown and
keepers can be toggled for every team. The UI enforces the auction budget and
minimum-dollar reserve for each open draftable roster slot, and shows each
team's selected keeper spend, money left, and maximum legal bid. Rival keepers
can be auto-projected as a starting scenario and then manually adjusted; the
user's own keeper selections are never cleared by "clear rival keepers."

### Trades
Reassign a draft pick to another manager (by round), or move a player/keeper
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
everything that used to be hardcoded — team count, scoring label, draft type
(snake/linear/auction — linear keeps the same team order every round, no
snaking; the draft engine only needs `overall()`/`slotForOverall()`/
`posInRound()` to know the difference, so trades/board/Strategy Lab all work
unchanged), superflex flag, starting lineup + flex eligibility, max
keepers, keeper-cost type (round/dollar), draft/keeper dates, owners, draft
order (`ownerSlot`), locked/known keepers, the roster data (`rostersRaw`,
pipe-delimited `owner|player|drafted_round|keeper_round`), and the player
pool CSV (`playersCsv`).

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
- Keeper deadline: **Sunday, August 30, 2026 at 12:00am PDT** (the Saturday-night boundary). Draft: **Monday, September 7, 2026 at 7:00pm PDT**; Yahoo lists the league's draft format as Offline Draft.
- 2026 authoritative keeper-eligible roster/cost source: Google Sheet **Fantastic Football Auction Keeper League Tracker 2026**. Those costs were manually reconstructed from 2025 end-of-season rosters plus 2025 auction results and already include the +$1 escalation. Draft Lab should consume the calculated 2026 costs rather than re-derive 2025 history this season.
- The finalized 2026 declaration is versioned as `fantastic-2026-final-2026-08-31`: 106 keepers, $1,454 committed, $1,346 remaining, and 118 open draftable slots. The profile retains stable manager keys but separately stores current Yahoo team display names and the 1–14 nomination order. Final records and validated per-team totals are documented in `docs/FANTASTIC_2026.md`.
- Built-in final keeper data is the first-run/mock baseline. Setup, config, and saved-mock payloads carry the keeper-data revision; a stale revision may retain independent tendencies/trades/queue state but must not restore pre-deadline keeper selections or draft sales into the final pool.
- Hovo auction guidance distinguishes **Market $**, intrinsic value, preferred **Target $**, roster-fit max, and optional break-glass max. The current portfolio preference and player/QB2/DEF ceilings live in `FANTASTIC_2026_STRATEGY` and are summarized in `docs/FANTASTIC_2026.md`.

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
| **Opponent pick logic** | Weighs rankings + team needs + positional scarcity; Basic vs Advanced modes | ⚠️ Partial — ours picks randomly within an ADP noise window; no roster-need or scarcity awareness |
| **Draft Intel** | Analyzes leaguemates' past drafts for tendencies; toggle per team into mocks | ❌ Missing — but high value here since it's the same 12 owners yearly |
| **Player queue** | Shortlist of targets, surfaced when you're on the clock | ❌ Missing |
| **Tiers** | Tier breaks in rankings + "players left in tier" counter that reddens | ❌ Missing (CSV already carries a `tier` column, unused) |
| **Draft Analyzer** | Post-draft grade, projected standings, positional ranks, strengths/weaknesses, steals & reaches | ❌ Missing |
| **Redo / restart from any pick** | Branch a mock from an earlier point to test alternatives | ⚠️ Partial — single-step `undo()` only |
| **Cheat Sheet Creator** | Import/blend rankings from any source, drag-drop reorder, custom tiers | ⚠️ Partial — Data tab imports a CSV; no reordering or blending UI |
| **Strategy comparison** | — (not a distinct DW tool) | ✅ Ours already exceeds this — Strategy Lab compares draft paths over N sims |

### Design direction

Draft Wizard's during-draft screen is dense and information-forward: best
available on the left with per-player value context, your roster and needs
alongside, the board underneath, and always-visible "what should I do right
now" guidance. Our Draft Room is already shaped this way — the gap is mostly
in the *decision support* (tiers, queue, scarcity/run signals, need-aware
opponents) and the *after-action review* (grade, steals/reaches, projected
finish), not in the overall layout.

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

## Deployment

See `CLAUDE.md` for the Worker/KV architecture — not a feature spec concern,
kept there to avoid duplication.

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
Live mock draft UI — best-available player pool, a roster viewer, a queue of
targeted picks, a full draft board (dashed cells = keepers), and my picks
& projected availability below the board. Supports snake, linear, and
(structurally, not the draft room itself) auction league types — see
"League profiles" below. Auction-type leagues show a placeholder here
instead of the pool/board — the auction draft engine isn't built yet.

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

### Teams & Keepers
Rival roster view and keeper assignment/modeling across the league, plus
the owner-tendency controls (see Opponent model below).

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
delete one. Falls back to local-only ("Save config" in the Data tab) when
the cloud API isn't reachable.

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
- Salary-cap/auction draft engine — multi-league support (see "League
  profiles") added auction-type league profiles, but the auction draft
  room itself isn't built yet; it shows a placeholder.
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

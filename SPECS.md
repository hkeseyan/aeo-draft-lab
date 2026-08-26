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
Persists via `/api/setup` alongside keepers/trades/tendencies (per account —
see "Accounts" below — once any account exists).

**Order and tiers**: Best Available is ADP-ordered by default. With custom
rankings switched on (see "My rankings") it's ordered by *your* board instead,
with a "My" rank column, and players you haven't ranked fall below the ones you
have, in ECR order — so a partial board (just your top 40, say) behaves
sensibly. Either way the list is broken up by tier, with a "N left" counter on
each break that turns amber at 4 and red at 2 or fewer. The count is over the
whole remaining pool, not just the visible rows. A tier break is drawn only the
first time a *deeper* tier appears going down the board: tier numbers aren't
monotonic in ADP order, and drawing every transition filled the board with
separators bouncing between the same two tiers. Breaks are suppressed while a
position filter or search is active, where they'd be meaningless.

**Scarcity cues**: a line under the draft controls answers what you actually
want to know on the clock — how many of each position have gone since your last
pick ("the run"), how many players are left in the top remaining tier at QB/RB/
WR/TE (red at 2 or fewer), and how many picks until your turn comes round again
after this one.

**Rewind**: `undo()` still steps back one pick; clicking any made pick on the
draft board (or entering a number in "rewind to pick") drops everything from
that pick onward and re-drafts from there, which is the "what if I'd taken the
RB instead" branch that a single-step undo can't reach. Keepers are pre-placed
rather than drafted, so they always survive a rewind.

**Draft analysis**: a card below the board grades every roster on its projected
starting-lineup points — the one number here that isn't a matter of taste, since
bench depth doesn't score. It reports your grade, projected finish and starting
lineup, a league table with each team's best and worst pick, and the biggest
steals and reaches league-wide. Value is measured against ADP (the market), not
against your own rankings, so a "steal" means the room let him fall. If the pool
has no projections loaded, it says so rather than presenting a table of zeroes
as grades.

### My rankings
Your own board on top of the market, per account and per league
(`GET/PUT /api/rankings`, KV `rankings:<user>:<league>`, with the same rolling
backup history as everything else — 20 snapshots, restorable from the tab).
Build it by seeding from ECR or ADP and rearranging (▲/▼, ⤒, or type a
destination number), or by pasting a ranked list of names, one per line —
matched forgivingly (case, punctuation, suffixes, and as a last resort every
non-alphanumeric character ignored), with anything unmatched reported rather
than silently dropped. Tiers are yours to set per player, with an "auto-tier by
gaps" button that picks the threshold from the data — the ~11 biggest ADP gaps
in your order become the boundaries, giving about a dozen tiers rather than the
3-or-80 a fixed threshold produces depending on the pool.

Turning rankings *on* only changes what you see: `available()` stays ADP-ordered
because that's what the opponent model runs on, so rivals keep drafting off the
market and the sim stays honest. ECR/ADP/projections are never overwritten.
This is deliberately the small version of the league-aware projections engine
still in design — a hand-built board, not a model.

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
and vice versa), now with the restore panel in the tab to match Trades' and
Leagues'. A rollup line answers the two questions the tab exists for — how many
are in/out/unsure, how much of the dues pot is collected, what's outstanding,
and how many owners have no contact details on file — with a per-owner
"outstanding" column and a "Copy contact list" button (clipboard, falling back
to a CSV download). Hidden entirely in guest mode, and admin-only once accounts
exist: unlike keepers and trades, dues and contact details aren't facts about
the draft, so members can't read them either.

Each owner row also has a **"Known by"** field — free text, e.g. "Dirty's
coworker" — for tracking who in the league actually knows that person
personally. Most useful once the league isn't the same 12 people who've known
each other for years: a vouch from an existing owner is worth recording
separately from whether someone's dues are paid.

A second card, **Prospective replacements**, tracks people being considered
for an open slot who aren't one of the confirmed owners yet — name, known by,
contact, status (considering/invited/confirmed/declined), and notes. Kept as
its own list (`COMMISH.__prospects`, an array) rather than owner rows, since
these people usually aren't in `OWNERS` at all — most never will be, since
most "prospects" don't pan out. Saved in the same `/api/commish` blob as the
owner rows, so it gets the same backup history for free; no new endpoint was
needed since that route already accepts an arbitrary JSON object.

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
- Salary-cap/auction draft engine — multi-league support (see "League
  profiles") added auction-type league profiles, but the auction draft
  room itself isn't built yet; it shows a placeholder.
- Accounts, subscriptions, tiers of access — personal tool.

## Accounts

Optional per-user auth, so the league can be shared with friends without handing
them the owner's board. **With no account created the app behaves exactly as it
did before this existed** — one shared save file, no sign-in, guest link
unchanged. Claiming the first account (Account tab) turns auth on and makes that
user the admin; the admin creates accounts for everyone else.

**Claiming that first account requires a one-time setup key** — the
`BOOTSTRAP_SECRET` Worker secret (`npx wrangler secret put BOOTSTRAP_SECRET`),
entered on the Account tab. Without it `POST /api/auth/bootstrap` refuses
outright: this Worker is public, its URL is deliberately shared (the guest
link), and admin carries write access to every league plus read access to the
commissioner's contact and dues data. "First to POST wins" would hand all of
that to whoever found the URL first and lock the real owner out permanently,
since only an admin can mint accounts once auth is on. It fails closed — no
secret, no bootstrap — and `/api/auth/state` reports `bootstrapReady` before any
account exists so the setup screen can say which state it's in.

What splits when accounts exist:

- **Shared, league-wide** — league profiles, keepers, trades. Facts about the
  league, so everyone sees the same board setup. Readable by anyone (the guest
  link depends on that); writable only by an admin.
- **Private, per account** — custom rankings, queue, per-owner tendency read,
  and the in-progress draft (`private:<user>:<league>`, `rankings:<user>:<league>`).
  Nobody else can load them, the admin included. Two people can run their own
  boards at the same time without colliding.
- **Mocks** — saved with `by: <user>`; you see your own, an admin sees all
  (including pre-accounts ones, which have no owner recorded).
- **Commissioner data** — admin only, read and write.

Mechanics: PBKDF2-SHA256 password hashing (100k iterations, per-user salt),
opaque session tokens in KV behind an `HttpOnly; Secure; SameSite=Lax` cookie
with a 30-day TTL. Changing a password or resetting someone's signs their other
devices out; deleting an account deletes its private data with it. No email, no
reset flow — an admin resets a password from the Account tab. This is a real
server-side boundary, unlike guest mode's UI-level one; the separate
`AUTH_TOKEN` env var remains an unrelated blunt gate over the whole API.

Members get the app minus the commissioner's half of it: Leagues, Data and
Commish tabs are removed from the DOM (not merely hidden), keeper checkboxes and
trade edits are read-only, and the shared-setup restore panel is gone — but
their tendency read, queue, rankings and draft are fully theirs to edit.

Migration is automatic and one-way: on an admin's first sign-in for a league,
whatever queue/tendencies/in-progress draft the pre-accounts shared record held
is adopted as that admin's private state. Members never inherit it.

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

## Yahoo import

Yahoo user-level Fantasy API access is still pending Yahoo's manual review
(blocked since 2026-08-23) — but that review turned out **not** to be the gate
for what we actually need. A *public* league needs no signed-in user at all.

### How it works

Yahoo's Fantasy API refuses every unauthenticated request with
`oauth_problem="unable_to_determine_oauth_type"`, which is what made this look
impossible at first. What it wants isn't a *user* — it's an *app signature*.
Public resources are readable with **2-legged OAuth 1.0a**: the request carries
`oauth_consumer_key` plus an HMAC-SHA1 signature computed from the consumer
secret alone, with no `oauth_token` and no consent screen. (This is what the
`yahoo-fantasy` npm package means by "public queries" — see its
`YahooFantasy.mjs` `api()`, which switches to exactly this when no user token is
set. YFPY's README claim that public leagues need no credentials at all is
stale; its own code still requires a consumer key and secret.)

So the requirement collapses to: **the Worker needs `YAHOO_CLIENT_ID` and
`YAHOO_CLIENT_SECRET`, and the league needs to be public.** Nothing else.

`GET /api/import/yahoo/:leagueKey` implements it, with the same
structure-only, review-before-save, never-auto-writes policy as the Sleeper and
MFL importers. It accepts a bare league id (`123456`, taken as this season's
NFL) or a full league key (`nfl.l.123456`, or an older season's
`449.l.123456`). It pulls `/settings`, `/teams/roster` and `/draftresults`, and
maps:

- league name, team count, season
- starting lineup from Yahoo's `roster_positions` (`DEF`→`DST`, `W/R/T`→`FLEX`,
  `Q/W/R/T`→`SUPERFLEX`; `BN`/`IR` dropped)
- draft type — note that `draft_type` reports live/offline/autopick and Yahoo
  flags auctions *separately* in `is_auction_draft`, so the string alone lies
- keeper vs redraft from `is_keeper_league`, scoring type, superflex
- owners, slots, and every rostered player
- **the real draft round per player**, from draft results — something neither
  the Sleeper nor MFL import can recover. Keeper *cost* is still left blank:
  the cost rule ("one round earlier than last year", etc.) is the league's, not
  Yahoo's, so guessing it would be inventing data.

When a Yahoo account *has* been connected through `/auth/yahoo/*`, the stored
bearer token is used instead of the app signature — same route, but private
leagues work too. The response reports which mode it used in `_authMode`.

### What's verified, and what isn't

Verified 2026-08-26:

- The OAuth 1.0a signing produces a signature **byte-identical** to the
  `oauth-signature` npm package (the same library `yahoo-fantasy` uses) for the
  same inputs, and its percent-encoding is RFC 3986 (escapes `!*'()`, leaves `~`).
- Yahoo **accepts the request shape**: signing with a deliberately fake consumer
  key moves the error from `unable_to_determine_oauth_type` to
  `consumer_key_unknown`, which means the signature, parameter set and encoding
  all parsed. OAuth 1.0a is therefore still live on this API.
- The response parsing runs correctly against **real recorded Yahoo payloads**
  (the `yahoo-fantasy` package's test fixtures): league meta, settings,
  `roster_positions`, the teams collection, a team's roster, and draft results.
  Yahoo's JSON is XML-shaped — collections are objects keyed `"0"`,`"1"`,… beside
  a `count`, and one entity is an array of small fragment objects — so `yList()`
  takes only numeric keys (a roster node sits next to `coverage_type`/`date`
  siblings that are not entries) and `yFlat()` deep-merges fragments.

Not yet verified: a real end-to-end import. That needs real app credentials
(`npx wrangler secret put YAHOO_CLIENT_ID` / `YAHOO_CLIENT_SECRET`) and a league
id, neither of which was available when this was built.

### If the league turns out not to be public

Fallback, in order: (1) connect a Yahoo account via `/auth/yahoo/start` — the
bearer-token path is already wired and covers private leagues; (2) failing that,
a paste-based import, since the app already eats
`owner|player|drafted|keeper` lines and the name matcher is forgiving. Scraping
the league web pages is not a route: they redirect to Yahoo's login wall.

## Deployment

See `CLAUDE.md` for the Worker/KV architecture — not a feature spec concern,
kept there to avoid duplication.

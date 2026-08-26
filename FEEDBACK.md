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

<!-- Newest first. One line per item: date, status, short description. -->
- ✅ 2026-08-26 — **Password minimum is too strict** — user wants 4 characters
  minimum and no other requirements. This is a fantasy-football tool shared
  with a dozen friends, not a bank.
  *Done — the 8-character floor is now 4, in all three places that enforce it
  (first account, admin-created/reset account, self-service change) and in the
  three UI placeholders. Verified against a local Worker: 3 chars refused, 4
  chars accepted for bootstrap, login, password change and member creation.*
- 🔧 2026-08-26 — **Get the Yahoo leagues in properly — settings, teams and
  rosters** — user's Yahoo leagues are public-facing and they want them
  imported the way Sleeper/MFL already are, without waiting on the pending
  Yahoo API access review. Asked to figure out how it's possible given the
  API's state, and offered to supply league IDs.
  *Research 2026-08-26: Yahoo's docs say public leagues can be queried without
  authenticating a *user*, and the `yahoo-fantasy` npm package (v5.3.0,
  `YahooFantasy.mjs` `api()`) shows exactly how — when no user token is
  present it signs the request with **2-legged OAuth 1.0a**: `oauth_consumer_key`
  + HMAC-SHA1 signature from the app's consumer secret, no `oauth_token`, no
  user consent. So the gate isn't a user login or the pending Fantasy API
  review — it's just having app credentials. Raw unauthenticated GETs return
  401 `unable_to_determine_oauth_type`, confirming *some* OAuth is required
  (verified against `/game/nfl`, `/game/nfl/game_weeks` and a `/players`
  lookup). YFPY's README claims no credentials are needed for public leagues,
  but its code still requires consumer key/secret — treat that README line as
  stale. Waiting on league IDs to test the HTML fallback and to confirm the
  leagues are genuinely public.*

- ✅ 2026-08-26 — **Custom rankings (v1, ahead of the full projections
  engine).** User wants their own player rankings in the app now — "it
  doesn't have to be the full projection capability we discussed elsewhere,
  that can be added on in the next 1-2 weeks" — but it must be (a) league-
  aware (rankings belong to a league profile, not global) and (b) saved
  across sessions and tied to their account, not to a browser. Supersedes
  the older 2026-08-24 "Custom/personal rankings" entry as the active
  thread; the 2026-08-25 league-aware projections-engine entry stays the
  anchor for the bigger model that layers on top of this.
  *Done — new **Rankings** tab, per account and per league
  (`GET/PUT /api/rankings`, its own KV entity with 20 rolling backups and a
  restore panel). Seed from ECR or ADP and rearrange (▲/▼/⤒/type a number),
  or paste a ranked list one name per line — matching got a new last-resort
  pass that ignores every non-alphanumeric character, so "Ja Marr Chase"
  finds "Ja'Marr Chase" instead of coming back unmatched. Your own tiers per
  player, plus an auto-tier button that picks the gap threshold from the data
  (~12 tiers) rather than a fixed number that gives 3 tiers on one pool and 80
  on another. Switching it on only reorders what **you** see: `available()`
  stays ADP-ordered so rivals keep drafting the market and the sim stays
  honest, and ECR/ADP/proj are never overwritten. See SPECS.md → "My
  rankings".*
- ✅ 2026-08-26 — **Real user authentication** — so the app can be shared
  with friends while keeping the user's own strategy and rankings hidden
  from them. This is the "multiple people / separate save files" idea
  (2026-08-25, previously "not that important") promoted to a now item,
  because custom rankings tied to an account need it as a foundation.
  Guest mode's UI-only trick doesn't cover it.
  *Done — optional accounts: with none created the app behaves exactly as
  before (one shared save file, no sign-in, guest link unchanged), and
  creating the first one on the new **Account** tab turns auth on and makes
  you the admin. League facts (settings, keepers, trades) stay shared and
  admin-writable; rankings, queue, tendency read and the in-progress draft
  become per-account, so a friend can run their own board without seeing
  yours and two people can draft at once. Mocks are tagged by author.
  Commissioner data is admin-only to read as well as write. PBKDF2-SHA256
  passwords + KV session cookies — a real server-side boundary this time, not
  guest mode's UI-level one. An admin's existing draft/queue/tendencies are
  adopted into their private record automatically on first sign-in. Verified
  end-to-end against a local Worker: role separation, private isolation
  between two accounts, mock scoping, password change and account deletion
  all behave. See SPECS.md → "Accounts".*
- 🆕 2026-08-26 — **Yahoo read-only import of *public* league data as a
  fallback** — user is still waiting on Yahoo Fantasy API access (manual
  review, blocked since 2026-08-23) and may not get it. Wants a plan in
  place for pulling public league data read-only, without OAuth, in case
  the answer is no or arrives too late for the Sept 8 draft.
  *Investigated 2026-08-26, plan written into SPECS.md → "Yahoo import:
  where it stands, and the fallback". Short version: reading public league
  data without OAuth doesn't look possible — the Fantasy API returns 401
  unauthenticated for every endpoint, and league pages redirect to Yahoo's
  login wall (the ids that don't redirect serve an error page, not league
  content). Caveat: no genuinely public league id was available to test
  against, so that's evidence, not proof. The fallback that needs nothing
  from Yahoo is a **paste-based import** — you're already signed in on
  yahoo.com where Draft Results and Teams are right there, and the app
  already eats `owner|player|drafted|keeper` lines with forgiving name
  matching. Scoped, not built — say the word and it's a small one.*
- ✅ 2026-08-26 — **Draft-day bundle** — the four self-contained in-app items
  from the older backlog, taken together this session: tiers with a
  "N left in tier" counter, pick-value/scarcity run cues on the clock,
  rewind-to-any-pick, and post-draft analysis/grade. See their individual
  entries below (2026-08-20) for the original asks.
  *Done — all four. **Tiers**: Best Available is broken up by tier with a
  "N left" counter (amber at 4, red at ≤2) counted over the whole remaining
  pool; the `tier` CSV column was being parsed away entirely, which is why it
  had never displayed. Breaks are drawn only when a *deeper* tier first
  appears, since tier numbers aren't monotonic in ADP order and drawing every
  transition produced 94 separators over 220 rows. **Scarcity**: a line under
  the draft controls showing the run since your last pick by position, how
  many are left in the top remaining tier at QB/RB/WR/TE, and how many picks
  until your turn comes round again. **Rewind**: click any made pick on the
  board (or type a pick number) to drop everything from there on and
  re-draft; keepers survive. **Analysis**: grades every roster on projected
  starting-lineup points, with your projected finish and lineup, a league
  table with each team's best/worst pick, and league-wide steals/reaches vs
  ADP — and it says so plainly rather than grading zeroes if the pool has no
  projections loaded.*
- ✅ 2026-08-26 — **Commish v2 polish** — the restore-panel UI that v1
  shipped without, plus a pass on which fields actually matter (dues
  totals/outstanding, returning-count summary, contact export).
  *Done — restore panel wired to the `/api/commish/history|restore` endpoints
  v1 already had; a per-owner "outstanding" column; a rollup line (in/out/
  unsure, dues collected vs owed, what's outstanding, how many owners have no
  contact details); and a "Copy contact list" button that puts owner /
  returning / contact / outstanding on the clipboard, falling back to a CSV
  download where the clipboard API isn't available.*

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
- ✅ 2026-08-25 (done 2026-08-26, see the "Real user authentication" entry at the top) — **Multiple people logging in with separate save files** —
  user's friend is now testing the app (via the guest link) and this came up
  as a "maybe later" idea: real multi-user accounts, each with their own
  save data, rather than one shared setup per league. Explicitly low
  priority ("not that important"). Would need real auth (the app currently
  has none beyond the optional `AUTH_TOKEN` env var that gates the whole
  API, not per-user) — a bigger lift than guest mode's UI-only trick. Not
  started.
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
- 🆕 2026-08-24 — **Can't see a rival's roster without scrolling, and can only
  see "my" roster** — wants a dropdown to pull up any owner's roster (not
  just mine), and wants the roster panel repositioned/prioritized ahead of
  "My picks & projected availability" so it's visible without scrolling —
  specifically so they can check the on-the-clock team's roster/needs while
  deciding a pick.
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
- ✅ 2026-08-24 (done 2026-08-26, see the "Custom rankings (v1)" entry at the top) — **Custom/personal rankings** — wants the ability to enter
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
- ✅ 2026-08-20 (done 2026-08-26, see the "Draft-day bundle" entry at the top) — **Tiers** — group players into tiers with a visible break
  in the pool list, plus a "N left in this tier" counter that turns red as a
  tier empties. Currently `players-2026.csv` has a `tier` column that the app
  parses but never displays.
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
- ✅ 2026-08-20 (done 2026-08-26, see "Draft-day bundle") — **Post-draft analysis / draft grade** — after a mock: grade,
  projected standings/finish vs the other 11 rosters, positional ranks,
  strengths & weaknesses, and biggest steals/reaches vs ADP.
- ✅ 2026-08-20 (done 2026-08-26, see "Draft-day bundle") — **Pick-value & scarcity cues on the clock** — show runs
  ("4 RBs gone since your last pick"), positional scarcity warnings, and
  who's likely gone before your next pick (already partly present as
  "projected availability" — wants to be more prominent).
- ✅ 2026-08-20 (done 2026-08-26, see "Draft-day bundle") — **Redo / rewind to any point** — Draft Wizard can restart a
  mock from any earlier pick to test a different branch. Today there's only a
  single-step `undo()`.
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

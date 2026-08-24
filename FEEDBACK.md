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

- 🆕 2026-08-24 — **MFL (MyFantasyLeague.com) import** — user has leagues
  there, wants the same kind of import Sleeper already has. MFL is an old,
  long-running platform with a historically simple export API (often no
  OAuth needed for a commissioner-enabled public export) — worth checking
  before assuming it's as involved as Yahoo's OAuth flow.
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
- 🆕 2026-08-24 — **Player pool size to ~200, later 250+ for some leagues** —
  wants to see what happens with a bigger pool (current AEO CSV has 184,
  draft is 192 slots). This needs sourcing more ranked players, not just a
  code change — flagged to the user rather than fabricating ADP/ECR values
  for extra players, since accuracy here matters for real draft prep.
- 🆕 2026-08-24 — **League *type* beyond keeper/redraft: dynasty, guillotine,
  bestball.** Dynasty: no keeper cost/value — every rostered player is
  assumed kept by default, removable individually later (e.g. a roster-space
  cut), rather than today's opt-in "choose up to N keepers" model. Applies
  now to the two new Sleeper-imported leagues. Guillotine and bestball are
  "maybe later," not scoped — explicitly deferred by the user. This is a new
  concept distinct from `draftType` (snake/auction/linear) and needs a
  design pass before building (see conversation — proposed as a `leagueType`
  field, confirming with the user before implementing).
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
- 🆕 2026-08-24 — **Draft board row misalignment** — when a cell's content
  wraps to a different height than its neighbors (e.g. a longer player name),
  rows across team columns fall out of sync, making the grid hard to read
  across teams at a glance.
- 🆕 2026-08-24 — **Draft board column headers show "T1"/"T2" instead of
  owner names** — hard to tell at a glance whose team a column is without
  cross-referencing the draft order elsewhere.
- 🆕 2026-08-24 — **Traded picks are hard to track on the board** — a traded
  pick shows in its original slot's column with a "→T4" tag; user finds this
  hard to parse and considered wanting it to show under the new owner's
  column instead, but wasn't sure that's actually better on reflection —
  showing owner names instead of "T4" (see above) may be enough to fix this
  without restructuring where traded picks appear. Revisit after that ships.
- 🆕 2026-08-24 — **Can't see a rival's roster without scrolling, and can only
  see "my" roster** — wants a dropdown to pull up any owner's roster (not
  just mine), and wants the roster panel repositioned/prioritized ahead of
  "My picks & projected availability" so it's visible without scrolling —
  specifically so they can check the on-the-clock team's roster/needs while
  deciding a pick.
- 🆕 2026-08-24 — **ADP/ECR data feels stale** — user has specific players in
  mind whose ADP should have dropped and ECR should have changed due to
  recent injuries, but the app doesn't reflect it. CLAUDE.md says a Cowork
  scheduled task refreshes this every Friday — worth checking whether that
  task is actually running/succeeding, or whether the lag is upstream
  (FantasyPros itself), before assuming the pipeline is broken.
- 🆕 2026-08-24 — **Custom/personal rankings** — wants the ability to enter
  their own player rankings instead of relying solely on ECR. User explicitly
  deferred this themselves ("we can keep it that way until we develop a
  different page or something") — not blocking, revisit later.
- 🆕 2026-08-24 — **League-aware custom projections engine** — a projections
  model unique to the league's settings/rules (e.g., in a keeper league,
  weight younger players higher). User explicitly deferred this themselves
  ("maybe that's something we can build later, not in this next iteration")
  — bigger idea, not scoped yet.
- 🆕 2026-08-24 — **Friendlier roster/keeper entry UI for new leagues** —
  today, populating League B/C's rosters/keepers means pasting pipe-delimited
  text into the Leagues tab's raw textarea (works, but not friendly). User is
  fine continuing to paste data via chat for now (or using the existing raw
  textarea directly) until either Yahoo import lands or this gets a proper
  form — explicitly deferred, not needed yet.
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
- 🆕 2026-08-20 — **Tiers** — group players into tiers with a visible break
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
- 🆕 2026-08-20 — **Player pool is smaller than the draft** — `players-2026.csv`
  has 184 players but the draft is 192 slots (12 × 16), so mocks run dry ~8
  picks early and the last round or two become forced scavenging. Either
  extend the CSV past 192 or shorten `LEAGUE.rounds`. Surfaced while testing
  the new opponent model.
- 🆕 2026-08-20 — **Post-draft analysis / draft grade** — after a mock: grade,
  projected standings/finish vs the other 11 rosters, positional ranks,
  strengths & weaknesses, and biggest steals/reaches vs ADP.
- 🆕 2026-08-20 — **Pick-value & scarcity cues on the clock** — show runs
  ("4 RBs gone since your last pick"), positional scarcity warnings, and
  who's likely gone before your next pick (already partly present as
  "projected availability" — wants to be more prominent).
- 🆕 2026-08-20 — **Redo / rewind to any point** — Draft Wizard can restart a
  mock from any earlier pick to test a different branch. Today there's only a
  single-step `undo()`.
- 🆕 2026-08-20 — **Keeper cost/value view** — a dedicated read on each
  keeper: cost round vs ADP round, surplus value, and which rival keepers are
  bargains. The math exists (`keepValue`) but isn't surfaced as its own view.
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

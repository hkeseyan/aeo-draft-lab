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

Single-page app (`public/index.html`), five tabs:

### Draft Room
Live mock draft UI — best-available player pool, "on the clock" indicator,
my picks & projected availability, my roster, and a full snake draft board
(dashed cells = keepers; clicking a team header on the board lets you set
who's on the clock manually).

### Teams & Keepers
Rival roster view and keeper assignment/modeling across the league.

### Mocks
Cloud-saved mock draft history (KV-backed via `/api/mocks`), synced across
devices. Save the current draft, list saved mocks newest-first, load or
delete one. Falls back to local-only ("Save config" in the Data tab) when
the cloud API isn't reachable.

### Strategy Lab
Compares draft paths/strategies side by side (`renderStratCards`). Rival picks
here use the same opponent model as the Draft Room, so Lab results and live
mocks don't diverge.

### Data
Player pool view (ADP/ECR/projection) and keeper list, plus config
export/import (JSON) as an offline backup independent of the cloud Mocks
feature.

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

Fixed by the `OWNER_SLOT` constant in `public/index.html`, e.g.:

```js
const OWNER_SLOT={Robert:1,Edward:2,Haiko:3,Aren:4,Taron:5,Dirty:7,Hovo:6,Savada:8,Jiro:9,Mher:10,Shant:11,Sako:12};
```

Not editable from the UI today — changing it means editing source and
redeploying. Open request to make this editable in-app: see `FEEDBACK.md`.

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
| **Opponent pick logic** | Weighs rankings + team needs + positional scarcity; Basic vs Advanced modes | ✅ Have it — rivals score on ADP + roster need, with a hard veto on depth-capped positions (see Opponent model, above) |
| **Draft Intel** | Analyzes leaguemates' past drafts for tendencies; toggle per team into mocks | ✅ Have it, hand-set instead of mined — per-owner QB/RB/WR/TE bias with an enable toggle (Teams & Keepers tab) |
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
  tracking) — this league doesn't draft on a synced platform.
- Salary-cap/auction and dynasty/rookie modes — the auction and superflex
  leagues are a separate roadmap item (multi-league selector), not part of
  matching Draft Wizard here.
- Accounts, subscriptions, tiers of access — personal tool.

## Player data

`players-2026.csv` (embedded into `public/index.html` as `PLAYERS_CSV`) is
250 players as of 2026-08-25:

- **Rows 1-184** (original): blended FantasyPros ECR + FantasyPros/Yahoo ADP,
  pulled 2026-08-03.
- **Rows 185-250** (added 2026-08-25): real, live FantasyPros consensus ECR
  and tier — 112 experts, dated the same day — pulled directly via `curl`
  once this session's environment Network Access was switched from Trusted
  to Full (Trusted's default-deny egress policy blocks fantasypros.com
  entirely; the ADP page itself is a client-rendered SPA with no reachable
  export, but `/nfl/rankings/half-point-ppr-cheatsheets.php` embeds a
  server-rendered `ecrData` JSON blob with ECR/tier/team/position for ~900
  players — that's the reusable path for future refreshes).
  **Caveat**: no live ADP feed was reached for this range (Yahoo's ADP page
  requires a signed-in session), so `adp` and `fp_adp` mirror `ecr` for
  these rows rather than an independently-sourced market ADP — expect the
  pool/value column (Δ = adp − ecr) to read 0 for anything below rank ~184
  until real ADP is merged in for that range.

Refreshing this data (whether extending further or re-pulling the whole
file closer to the draft) needs Full network access on the session's
environment — see `CLAUDE.md` for that setting.

## Deployment

See `CLAUDE.md` for the Worker/KV architecture — not a feature spec concern,
kept there to avoid duplication.

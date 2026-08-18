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
Compares draft paths/strategies side by side (`renderStratCards`).

### Data
Player pool view (ADP/ECR/projection) and keeper list, plus config
export/import (JSON) as an offline backup independent of the cloud Mocks
feature.

## Draft order

Fixed by the `OWNER_SLOT` constant in `public/index.html`, e.g.:

```js
const OWNER_SLOT={Robert:1,Edward:2,Haiko:3,Aren:4,Taron:5,Dirty:7,Hovo:6,Savada:8,Jiro:9,Mher:10,Shant:11,Sako:12};
```

Not editable from the UI today — changing it means editing source and
redeploying. Open request to make this editable in-app: see `FEEDBACK.md`.

## Deployment

See `CLAUDE.md` for the Worker/KV architecture — not a feature spec concern,
kept there to avoid duplication.

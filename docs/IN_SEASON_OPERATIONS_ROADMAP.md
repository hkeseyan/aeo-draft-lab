# Fantasy in-season operations — verified safety net and decision intelligence
Status: requirements and phased implementation plan; **not deployed**. Updated 2026-11-18.
Owner: Fantasy Sports Assistant / AEO Draft Lab. Daily OS is the task index and chronological diary, not a parallel fantasy specification.

## Purpose and baseline
Reduce mandatory cross-league administration without removing enjoyable optional research. User estimates **more than three hours per week**, not a measured total: ~30 minutes reviewing football transactions one morning, ~40 minutes on Tuesday dynasty screening, sometimes ~2 hours weekly on NFL waivers, ~15 minutes each on NBA and NHL basic review, plus additional checks/research. Establish actual baseline and time saved in pilot; initial target >=50% reduction in *mandatory* time, with no critical missed actions.

## Three service tiers
1. **Safety verification (automate first):** per league, confirm sync and waiver-processing state; identify newly acquired/dropped players, open legal starter slots with eligible benched players, stale lineups after transactions, injuries/late scratches with viable replacements, and imminent lock deadlines. After every transaction verify current day plus next day, preferably next 2–3 days. League-specific Yahoo, Fantrax, Sleeper rules apply. Sleeper Lock-In stays manual while user learns it.
2. **Opportunity intelligence:** waiver outcomes and competing/winning FAAB prices, newly dropped players, waiver-clear times, near-term opportunities, ranked candidates, and reasons/urgency. Provide brief voice-ready summary with explicit action deadline.
3. **Optional strategy/research:** dynasty upside, player comparisons, trades and detailed evidence; user chooses when to explore.

## Coverage contract (critical)
Every configured league has platform, league ID, format, source, last successful read time, last transaction scan time, lineup horizon checked, and one status: VERIFIED_SAFE, ACTION_REQUIRED, PARTIAL, UNVERIFIED, ERROR. Never equate a failed sync or unsupported lineup access with safe. Record evidence, data freshness, locks and uncertainty; allow resumable league-by-league review. No claimed monitoring or write access without verification.

## Player opinions, value and change detection
Store player assessment separately from league-specific urgency and market value. User opinions are timestamped, reasoned, confidence-tagged and scoped (e.g. dynasty vs redraft, contender vs rebuilding). Strong dislikes and exclusions are **reviewable hypotheses**, never immutable filters. Trigger reassessment on material injury/depth-chart changes, snaps/routes/usage trend, role or contract change, strong market movement, or divergence between internal valuation and consensus / large week-over-week rank delta. Surface significant exceptions even for excluded players, with what changed and a proposed revised take; user confirms opinion changes. Market signals (roster %, trending, FAAB) inform opportunity but are not value proofs. Dynasty screen prioritizes low-rostered, rising-role contingent-upside players; current-week projections are not the primary metric for rebuilding teams. Brevyn Spann-Ford/Jake Ferguson was an illustrative hypothesis, not verified news.

## Five-minute briefing output
(1) coverage count by verified/action/unknown, (2) waiver wins/losses and bid market, (3) newly dropped watchlist and clear times, (4) actionable lineup/IR/lock exceptions, (5) biggest player-value disagreements/new catalysts, (6) optional research queue and user decisions. Alert only on actionable changes; avoid generic news and duplicate alerts. Every briefing logs source times and decisions, not merely prose.

## Execution plan and acceptance gates
**P0 — audit current capability:** inspect actual AEO Draft Lab data reads, league registry, waiver history, schedule, notification and lineup coverage. Distinguish built features from proposals. Compare existing Google Drive `fantasy-daily-briefing-protocol.md`, `fantasy-valuation-engine-handoff-2026-09-07.md`, and `02 - Integration, Automation, and Scaling Notes` (Sections 14+). Do not replace those historical narratives.
**P1 — narrow pilot:** choose one Yahoo NFL waiver league and one Yahoo NHL/NBA league; implement per-league coverage ledger, transaction diff and post-acquisition lineup audit where authorized reads support it. Test missing permissions, stale reads, waived players and reset lineups; log false negatives.
**P2 — actionable daily briefing:** generate ranked exceptions, FAAB market and newly dropped waiver targets with exact unlock timing and sources; deliver via supported channel and verify receipt.
**P3 — opinion/rank reconciliation:** versioned opinions and catalyst-based rank disagreements; integrate user voice decision log with review triggers.
**P4 — broaden:** other leagues and platforms, Fantrax weekly locks, Sleeper Lock-In research, pregame MLB/NHL monitoring, optional authorized write operations. Do not assume write support.

## Return point and cross-project handoff
Daily OS cards: umbrella `18966ee6-6558-4414-aa69-d10d502c09ea`; data/waiver `d40cebb4-b28d-431e-8bf3-501cde35f489`; decision logic `71af14d8-54d1-422a-b35b-1fb637a7c11f`; narrated walkthroughs `da9ab86d-2bb6-46df-8647-333b23d1bb71`. Weekly sport chats in Fantasy Sports Assistant project remain the source for narrated examples; link outcomes to cards and this specification rather than re-recording transcripts. First return action: audit repo capabilities and Google Drive specs, choose pilot leagues and produce an implementation checklist; no new broad card required.

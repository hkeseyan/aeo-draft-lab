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

- ✅ 2026-09-18 — **NHL ranking metrics don't cohere, and My Rank should encode roster construction.** User reports ECR / My Rank / proj varying wildly from Yahoo ADP, with concrete cases: players projected ~400 sitting next to ~600 at the same position; a case of <200 next to 400+; and Hellebuyck vs Oettinger adjacent in ADP (G2/G3, both ~24) while ECR/My Rank put Hellebuyck at 24/23 and Oettinger at 42/41 despite Hellebuyck projecting >10% more points. Wants the algorithm explained, not just patched. Also gave detailed roster-construction strategy for Yahoo default points: **C-only is the least valuable forward** (only 2 C start per night, and C is the most streamable position because offence flows through centres) — prefer 1-2 strong C-only and stream the rest, strongly favour C+W dual eligibility; elite players (McDavid/MacKinnon) transcend the rule, so it should bite from roughly picks 6-10 onward, not at 1.01. **G**: streaming-friendly; 1st premium starter very valuable, 2nd is value-based, a 3rd must be an unpassable value. **D**: not streaming-friendly by preference (forwards win a contested slot) but may be streamed when forwards are gone; wants 4-5 solid D, 2 of them mid-level-forward equivalent, and a premium D or two early without reaching. Asks: use My Rank to build on ADP/ECR/proj with positional inflation; show **all** eligible positions in the draft list; possibly display multi-forward-eligible players as F rather than C. *Answered and built.* **Diagnosis, all verified against the data:** (1) **My Rank was literally ECR order** — `computeMyRanks()` only knew football adjustments (elite QB/TE bump, rookie fade), both no-ops in hockey, so it passed ECR straight through. That is the whole Hellebuyck/Oettinger puzzle. (2) **ECR is 2 experts scoring ROTO**, a different game — exactly the Tkachuk/banger effect the user already intuited, and the reason it is now weight 0 in My Rank while staying a visible column. (3) The **board sorts by market ADP**, so same-position neighbours reflect the market, not projections. (4) The big proj gaps are our projection being weak on low-sample players — Hagens 54, Cole Hutson 150, Yakemchuk 74 are prospects; M. Tkachuk 320 is an injury season. (5) On the specific goalie case: **Oettinger actually projects ~10% ABOVE Hellebuyck**, not below — Hellebuyck posted .895 with 0 shutouts and 23 wins in 2025-26 (verified against the raw NHL feed, not a data bug), so our projection is right about last year and the market is right that he bounces back. Our model has no mean reversion; recorded as a known gap. **Built:** hockey-specific `computeMyRanksNhl` — ADP/proj blend with the projection trusted in proportion to sample (`gp`), then PROPORTIONAL positional adjustments (flat rank offsets were badly wrong: 8 spots is the whole elite tier at pick 5 and nothing at pick 200). Centre-only marked down with the penalty phasing in past the elite tier (replaceability, not slot count, is the real argument); dual/triple forward eligibility marked up; elite tier exempt from BOTH so a C/LW can't leapfrog McDavid; goalie premium for volume starters and a markdown past `teams x G slots`; small bump for elite D. Result: top 5 is pure merit, C-only averages -10 spots vs ADP and C+wing +9. Every player carries a plain-language `myRankWhy` tooltip. **Display:** Best Available now shows all eligible positions (`C/LW`) with an **F** chip for multi-forward eligibility, and the position filter matches eligibility so LW surfaces C/LW too.

- ✅ 2026-09-17 — **Next after NHL v1: real market ADP for the hockey pool, then a Fantrax import.** User approved both. (1) The NHL pool currently uses *our projection rank* as `adp`/`ecr`, so mock rivals draft to our own board and mocks feel too agreeable — needs a real market ADP layered in. (2) Fantrax has a usable league-ID-keyed external API (`fxea`), unlike Yahoo whose approval has been silent a month, so it's the right next integration and also covers hockey dynasty. *Both done.* **ADP:** found two usable FantasyPros NHL feeds — the rankings page embeds `ecrData` as JSON in the HTML (349 players, with a `player_positions` field carrying real multi-position eligibility), and the ADP page is a plain HTML table broken out **per host site, including a Yahoo column**. The pool now carries `adp` = real Yahoo ADP (264 matched), `ecr` = FantasyPros consensus (340 matched), and `proj` = ours, as three separate columns rather than one blended number — the gap between `adp` and `proj` is the signal. 58 multi-position players in the top 400 (Draisaitl C/LW etc.). Board is now market-ordered: McDavid 1, MacKinnon 2 (our projection has MacKinnon first — that disagreement is exactly what the tool is for). Honest caveat recorded in SPECS: `proj` has no aging curve, so it overrates declining veterans (John Gibson, Malkin and Mantha all show huge fake 'value'). **Fantrax:** `GET /api/import/fantrax/:leagueId` added, mirroring the Sleeper/MFL importers (review-before-save, always creates a NEW league). Verified the `fxea` API is live and needs no auth. Two real traps handled and tested: Fantrax returns **HTTP 200 with an `error` body** on a bad league id, and two franchises can share a display name, which would merge two rosters under the app's name-keyed model (duplicates get suffixed). Unnamed players keep their Fantrax id and are counted in the import note rather than silently vanishing. Fantrax does report draft type and roster size, so the importer fills those too. New `tests/fantrax-import.test.mjs` drives the real worker route with stubbed responses; boot-smoke is now 45 assertions.

- ✅ 2026-09-17 — **GO: build and deploy hockey. Plus: Yahoo API is dead in the water, Fantrax as alternative, possible Best Puck (NHL best ball), and a hard requirement for OUR OWN logic.** User gave the go-ahead to build and deploy. Four things attached: (1) **Yahoo's Fantasy API approval has been radio silent for a month** — so "just connect to Yahoo" is not a plan we can lean on; asked about **Fantrax** as an alternative. (2) They'll email the Hashtag dev about data access. (3) May join **NHL Best Ball / "Best Puck"** — draft-only, zero in-season management, which would be the lowest-effort league type to support. (4) **The important one:** they explicitly do NOT want to just consume someone else's waiver lists and rankings — "otherwise I would be complacent with the tools I am already paying for from them." They want **our own logic**, concretely: *a daily shortlist of which players to add, based on schedule and point-scoring opportunity*. That reframes the whole in-season piece — Hashtag is a data input at most, not the product. Our differentiator is the daily add-radar driven by our own scoring model. *Built and deployed the same day.* Sport packs replace the hardcoded football positions (`blankCounts`, depth caps, the K/DST lateness rule, tendency positions, auction multipliers, position colours and filters); a header sport switcher scopes the league dropdown per sport and remembers the last league within each; multi-position eligibility (`C/LW`) flows through roster slotting, roster-need scoring and flex filling; a **Yahoo NHL Public** profile ships with the verified defaults; a 400-player pool is projected from the NHL's own public stats API (2025-26 rates shrunk toward positional means by games played, times projected games) and scored through Yahoo's point values; and the **Add Radar** gives the daily shortlist the user asked for — opportunity = projected points per game x games in the window x a light-night bonus, with the 4-adds-per-week and 3-goalie-games constraints shown alongside. New `GET /api/nhl/schedule` route proxies and caches the NHL schedule. Also fixed the long-standing `collectLeagueForm()` bug that reverted `flexEligible` to football's `['RB','WR','TE']` on every save. New `tests/boot-smoke.mjs` boots the page in jsdom and asserts 37 behaviours across both sports. **Answers to the two questions raised:** (a) **Fantrax does have a usable API** — `fantrax.com/fxea/general/getTeamRosters?leagueId=...&period=N`, plus `getLeagueInfo`, standings, draft picks and draft results, keyed by league ID much like Sleeper and MFL rather than gated behind an OAuth approval queue, with community Python/Go wrappers proving it works. That makes Fantrax a far better integration target than Yahoo while Yahoo's approval stays silent, and it's also the dynasty platform of choice for hockey. (b) **Best Puck is Underdog Fantasy's NHL best ball** — snake draft, best scorers counted automatically, no waivers or lineups at all, regular-season points phase then playoff weeks. Draft-only, so it fits the existing Draft Room with zero in-season burden; `leagueType:'bestball'` already exists as a selectable value. **Known gaps, deliberate:** the pool's `adp`/`ecr` are our projection rank, not market ADP (no free NHL ADP feed), so mock rivals draft to our board rather than a real market; the projection is prior-season rates with no aging curve or role/line context; category scoring is not built because Yahoo's default is points.

- 🆕 2026-09-17 — **User is on Hashtag premium ($2.50/mo); asks about Hashtag → own DB → Draft Lab as an architecture. Also asked why no hockey is visible on the live site.** Answered: (a) there is still no Hashtag API — their "import" is one-directional (you paste a Yahoo/ESPN League ID, *they* ingest it into *their* tools), so there's nothing to pull from; and the league/roster half of what they ingest comes from Yahoo, which we can read at the source instead of adding a hop through a third party. The part worth wanting is Hashtag's own derived content (projections, waiver rankings, schedule grid), which has no API and is covered by their redistribution clause. (b) **Nothing about hockey is built or deployed — by design.** Everything so far is planning/research docs; the Cloudflare builds that went green were docs-only commits that never touched `public/index.html` or `worker.js`, and PR #18 is still open against `main`. Waiting on a go-ahead to start the day-1 foundation (offered twice).

- 🆕 2026-09-17 — **Hashtag Hockey as a data/sync source.** User has an account at hashtaghockey.com and says it has an API to pull and sync their teams; asks whether we can feed that into Draft Lab. Relevant because Hashtag's basketball sibling is the category/z-score gold standard, and because FantasyPros has no NHL league sync (see the entry above). **Researched, same day: there is no public API.** Nothing on the site, the premium page, the basketball sibling, or anywhere findable documents one, and no developer access is offered. What looks like an API is their **league import** — you paste a Yahoo/ESPN *League ID* into their site and *they* pull your league in for use inside *their* tools. An import into their product, not an interface we can call. **But the find still matters, and it corrects two earlier conclusions.** (1) Free tier includes category **and points-league** rankings/projections, an Advanced NHL Schedule Grid, Trade Analyzer, Auction Values, Sleepers, ADP and Starting Goalies; premium is **$2.50/mo via Patreon** (Patreon email must match a site account) for Premium Schedule Grid with waiver availability, Waiver Wire Rankings, Draft Tracker, Trade Machine, Waiver Machine, League Scouting Report and Beast Mode. So the earlier "in-season management for NHL is ours to build or it doesn't exist" is **too strong** — Hashtag covers a real share of it cheaply; what stays ours is management *across* several leagues at once, driven by our own valuation. (2) Their points-league projections already carry **exactly the component stats Yahoo's default scoring needs** (GP, TOI, G, A, +/-, SOG, BLK, PPP; goalie SV, GA, SHO, W) — not customizable to league point values, but that's fine because we apply the values ourselves. That's the scoring-aware projection the plan asked for **without building one from raw MoneyPuck data** — a meaningful week-1 shortcut. Also noted: **Hashtag Basketball is further along than the hockey site** (syncs Yahoo, ESPN, **Fantrax and Sleeper**, plus a Mock Draft Simulator and Matchup Planner) — relevant to the NBA month. Path to get data in, in order: **manual paste into the existing Data tab works today with zero code**; Yahoo's own API for roster sync (better than routing through Hashtag, which doesn't expose what it imports); scraping is possible but contract-free, fragile, and their terms bar "redistribution or republication" without consent while saying nothing explicit about automated access — personal use in a private tool isn't republication on a plain reading, but the guest-link sharing this app supports is where that would stop being true; and simply emailing them, since it's a small operator with an active Patreon/Slack. Plan doc updated with a new §6.1 plus revisions to §6, §7, the open questions and sources. New open question: **is the user on the premium tier or only the free tools?**

- 🆕 2026-09-17 — **NHL direction: Yahoo public default leagues, and in-season team management is a gating requirement.** User: build against **Yahoo default public leagues**; will join **at least 2** (possibly points scoring — "whichever is easiest for us to manage"), then maybe other public prize leagues (roto etc.), then custom commissioner-run prize leagues. Two open questions they raised that change scope: (1) can we rely on a **FantasyPros MyPlaybook** equivalent for NHL the way they do for NFL — this **determines how many leagues they join**, so it's a gating research question, not a nice-to-have; (2) are other platforms good for hockey, **especially dynasty**. Note this moves in-season team management from "deferred past the drafts" (see the 2026-09-17 multi-sport plan entry) toward a first-class requirement — the number of leagues they commit to depends on whether management is automatable. **Researched and answered, same day.** (a) **FantasyPros My Playbook does not exist for NHL** — `/nhl/myplaybook/` returns HTTP 404, while NFL, MLB and NBA all have it. FantasyPros' hockey section is **draft-only**: consensus rankings by C/LW/RW/D/G plus a Draft Mode, no league sync, no start/sit, no waiver or trade assistant. So for hockey, in-season management is ours to build or it doesn't exist — which promotes it from "deferred past the drafts" to a real requirement. Silver lining: NBA *does* have My Playbook, so the Oct–Nov phase has a fallback hockey lacks. (b) **Yahoo's default public NHL league is Head-to-Head POINTS**, 10 teams, 2C/2LW/2RW/4D/2G + 4 bench + 2 IR (18 max), daily roster changes, **4 acquisitions/week**, **3 goalie games/team/week minimum**, skaters G6/A4/+-2/PPP2/SOG0.9/BLK1, goalies W5/GA-3/SV0.6/SHO5, playoffs weeks 23-25. **This reverses the earlier categories-first call** — the user's first leagues need one number per player, which the existing engine already does, so the z-score category engine drops out of the two-week window entirely and moves to the NBA month (still needed for the roto prize leagues later, and NBA/MLB are category-native). Biggest de-risking finding in the plan. Also note the default has **no Util/flex slot** (flex code path unused), a tight 4-spot bench against the 4-add cap, and SOG/BLK scoring that rewards volume shooters and shot-blocking D — a naive goals+assists board would be wrong. (c) **Dynasty platform: Fantrax** is the hockey dynasty/keeper standard (automated salaries/contracts, tradeable future picks, deep customization); Yahoo/ESPN are weaker; **Sleeper doesn't do NHL at all**. Cross-platform ADP differs meaningfully (Yahoo/ESPN/Fantrax/CBS), so anchor on Yahoo's own ADP since that's where we're drafting. Management automation is unusually tractable for hockey because Yahoo's constraints are arithmetic — free machine-readable inputs exist (NHL public API for schedule/games-per-week/rosters, Daily Faceoff and Left Wing Lock for light nights, starting goalies and line combos). **Recommendation: start with the 2 default Yahoo points leagues, add more only after the management tool ships and survives real use.** `docs/MULTISPORT_PLAN.md` rewritten around all of this with sources.

- 🆕 2026-09-17 — **Multi-sport expansion: NHL now, NBA next, MLB later.** User wants to reuse this app for fantasy hockey (drafts imminent), then basketball, then baseball. Yahoo confirmed for NHL; other platforms still being researched. User proposed a sport toggle at the top of the existing site to switch between sports. Stated schedule: **NHL over the next 2 weeks, NBA for the full month+ after that, MLB a few months later.** Wrote `docs/MULTISPORT_PLAN.md` — full plan, recommendation, sequencing and risks. Summary of the recommendation: **yes to the toggle, but sport becomes a field on the league profile** (`sport:'nfl'|'nhl'|'nba'|'mlb'`, default `nfl`) with a header sport filter scoping the existing league dropdown — one deployment, one codebase, no `/api/*` changes needed (every route is already `?league=`-scoped). Sport drives a **sport pack** config (positions, colors, flex/util defaults, depth-cap rule, late-round-position rule, tendency positions, auction posMult, data adapter) that replaces today's hardcoded QB/RB/WR/TE/K/DST constants — a bounded ~dozen call sites, because the app was already generalized once for multi-league. Key finding: **NFL is the outlier, not the template** — NHL/NBA/MLB all share multi-category scoring (value is a vector, needs z-scores, not one `proj` number), multi-position eligibility (`pos` → `posEligible[]`), daily lineups + games-played/schedule as a real resource, and a separate goalie/pitcher economy. So build the category core **once, for NHL**, and NBA 9-cat + MLB 5x5 become mostly configuration. Corollary: this **forces roadmap item 5** (league-aware custom rankings/projections engine) — hockey is unusable without a version of it — so the sport expansion and item 5 are one project, not two. Cheapest concrete win found: `worker.js:697` hardcodes `game_keys=nfl` on `/api/yahoo/leagues`; Yahoo's Fantasy API is the same shape across sports, so that's a one-word change to start listing NHL leagues. Open questions put to the user: per-league NHL facts (cats vs points, roto vs H2H, keeper vs redraft, teams/slots/draft date/draft type), and whether the Yahoo developer app's Fantasy Sports API access ever cleared its manual review (blocked as of 2026-08-23 — everything Yahoo-dependent needs a manual-entry fallback). **User answers, same day:** NHL scoring format not settled and may vary by league (so we build categories first — points falls out of it free); **redraft only for now**, no existing keeper/dynasty hockey leagues, and they'd join one *only if we build great in-season management automation*; if a keeper/dynasty league does happen it would be a **startup** (first-year draft, no existing keepers). First NHL draft is **1–2 weeks out**, so the sequencing stands. Two consequences folded into the plan: (1) week 1 touches no keeper/dynasty code for hockey at all — a startup draft is mechanically an ordinary redraft draft, and what differs is *valuation* (age curves, multi-year value), which is the rankings engine's job, so dynasty is cheap on the draft side and expensive on the in-season side — the opposite of how it looks from the football profiles; (2) the "in-season tools are out of scope" non-goal now has a condition on it — it's the specific thing that would unlock a whole league type for this user, so it's deferred past the drafts rather than written off, and belongs in the NBA month's scope conversation. Nothing built yet — this entry and the plan doc are the whole change.

- ✅ 2026-09-17 — **Shared in-season league-data layer + FantasyPros fallback.** Added a normalized KV snapshot and provider coverage/status metadata for use by FAAB and future lineup/waiver/trade/roster tools. Configured leagues refresh every four hours. Yahoo remains authoritative for ownership and the complete newly dropped pool; FantasyPros MyPlaybook can securely supply roster, lineup, weekly projection, injury, opponent, ECR, and schedule context when Yahoo fails. The MyPlaybook league key is stored separately and never echoed to the client. Empty partial feeds cannot erase the last good/manual waiver pool. A complete FantasyPros available-player feed remains the next source-integration gap.

- ✅ 2026-09-16 — **In-season guillotine FAAB Lab + Tuesday reports.** Added a league-aware FAAB Lab with Yahoo roster/waiver sync plus manual CSV fallback, saved weekly inputs/report history, calibrated recommended/projected-winning/stretch bids, lineup-upgrade and endgame reasoning, schedule/bye/injury/teammate-opportunity inputs, 18-team versus 12-team market bands, and Tuesday 1:00am America/Los_Angeles scheduling that handles DST. Calendar reminders download as recurring `.ics`; email-now/automatic Tuesday delivery is wired through optional Resend secrets. Competitor remaining budgets are deliberately disclosed as not-yet-modeled and remain the next calibration layer; native iPhone push is still a later evolution.

- ✅ 2026-08-31 — **Fantastic 2026 keepers finalized and mock-ready.** Normalized all 14 Yahoo teams into stable manager IDs + current team names + final nomination order; validated 106 keepers, $1,454 keeper salary, $1,346 remaining, and 118 open slots. Added version-aware defaults/migrations so stale pre-deadline setup, config, or mock state cannot replace the final pool, while unrelated profile fields and independent setup data remain intact. Captured Hovo's balanced-build preference, premium-lock rule, target/roster-fit max concepts, QB2 shortlist/budget, and Ravens-only $1 defense preference in the Fantastic profile and `docs/FANTASTIC_2026.md`.

- ✅ 2026-08-27 — **Separate auction market-price model from Hovo target-bid model; add external price sources.** Market $ and Target $ are separate layers. Yahoo league-aware values anchor opponent behavior; FantasyPros league-structure calculations anchor Hovo's independent one-year value; replacement level, keeper retention and remaining-budget inflation are applied by league. Optional source columns remain extensible without rewriting auction mechanics.

- ✅ 2026-08-27 — **Auction keeper profiles + mock-draft MVP, with corrected league facts.** Global keeper/dynasty/redraft definitions and IR-as-value-overlay remain as captured. Fantastic is Yahoo 835427, **14 teams / 16 draftable + 2 IR**, $200, full-PPR/6pt-pass-TD, deadline **Sun 2026-08-30 12:00am PDT**; 2026 costs come from the completed `Fantastic Football Auction Keeper League Tracker 2026` Sheet. AEOK Auction is Yahoo 868349, **12 teams / 18 draftable + 2 IR**, full-PPR Superflex, Live Salary Cap draft **Tue 2026-09-08 9:00pm PDT**, keeper deadline **2026-09-08 12:00am PDT**; its Sheet's manager tabs are authoritative because they apply the special undrafted-QB $6 rule. Added both built-in league profiles plus an auction Draft Room MVP: editable projected/actual keepers for every team, keeper budget legality, team money-left/max-bid views, manual sale recording, undo/reset, simulated market sales, and auction mock persistence. Provisional market-dollar estimates are scenario aids only until the custom rankings/projections/auction-value engine is calibrated; keeper decisions are intentionally not finalized from these values alone.
- ✅ 2026-09-02 — **League-calibrated auction price inputs.** Market $ embeds authenticated Yahoo League Value and Average Salary separately for Fantastic and AEOK. Target $ embeds FantasyPros Salary Cap Calculator output separately configured for each league's team count, $200 budget, draftable roster size, and flex/superflex structure. FantasyPros Custom Scoring is unavailable on the current account, so its component is accurately labeled as default full PPR; RotoWire is omitted. Source prices retain their published starting scale and are adjusted only for keeper/sale inflation relative to that baseline. Fantastic's keeper choices were subsequently finalized in the separate 2026 keeper snapshot above.

- ✅ 2026-09-03 — **Production/repository divergence reconciled.** The recovered production Worker and UI are now the reconciliation base, retaining Google sign-in, per-user scoping, Yahoo diagnostics, board-on-top layout, My Rank, draft cues/grades, player media, and the richer auction room. The auction source data and finalized Fantastic snapshot were layered onto that base with versioned, bounded profile migrations. Future production changes must merge through this reconciled Git line; do not deploy an older branch directly.
- 🔧 2026-09-03 — **New leagues for tonight's 7pm drafts: added as skeletons, need real data.** User is drafting two leagues tonight at 7pm: **"Off With Their Heads"** (guillotine, 12-team-style, user is commissioner, currently 14 of up to 18 team slots filled, doesn't need to fill all the way) and **"SCG IRS"** (ESPN, user's work league, "basic"/standard redraft — full settings pending, user will supply when at a computer). Added `league:off-with-their-heads` (`leagueType:"guillotine"`) and `league:scg-irs` (`leagueType:"redraft"`) directly via KV with placeholder settings (teams/starters/scoring all flagged TBD, `owners:[]`) so both leagues exist in the Leagues tab — **not yet usable in the Draft Room until real owners/settings are added**. Still needed before 7pm: owner/team list for both (ask whether "Off With Their Heads" is hosted on Sleeper — this app already has a Sleeper import that could pull real owners/rosters automatically instead of manual entry), and ESPN scoring/roster settings for SCG IRS. Also mentioned, not yet started: a second guillotine league **"Off With Their Heads Too"** (~12 people, same rules, drafts Saturday noon, needs dues tracking via Commish tab), plus more leagues drafting Sat 9/5, Sun 9/6, Mon 9/7 (details pending), and ~10-12 leagues total eventually. Two dynasty slow drafts already exist and look fine as-is (`league:die-nasty`, `league:gsb-dynasty-football`, both show user as owner handle `EAS103`) — user says not urgent, "doing okay," lots of time between picks.
- 🔧 2026-09-03 — **Real settings captured for all 3 tonight/Saturday leagues; owners still missing.** Both guillotine leagues are Yahoo, not Sleeper (no auto-import available; Yahoo OAuth in this app is diagnostic-only, no full league import built). Wrote real settings into `league:off-with-their-heads` (Yahoo 274725, 18 teams assumed, draft **Thu 9/3 7:00pm PDT**), `league:off-with-their-heads-too` (Yahoo 1494181, "Off with their heads pt 2", 16 teams assumed pending Friday update, draft **Sat 9/5 12:00pm PDT**), and `league:scg-irs` (ESPN "SoCalGas IRS", 12 teams, draft **Thu 9/3 7:00pm PDT** — same night/time as Off With Their Heads #1, two simultaneous live drafts). Both guillotine leagues: no K/DST rostered at all, QB/2WR/2RB/TE/2xW-R-T flex/2BN/1IR (11 rounds), half-PPR, 4pt pass TD/-1 INT, 6pt rush-rec-return TD, no trades allowed all season, and a **league rule not modeled by this app**: 1 roster spot added after every 4th week (season-long waiver-relief mechanic, doesn't affect draft night). ESPN: QB/2RB/2WR/RB-WR-flex/TE/K/DST starters + 5 bench drafted (14 rounds) + 3 IR filled via waivers only, half-PPR, 4pt pass TD/-2 INT +1 bonus on 50yd+ TDs, distance-tiered FG/full DST scoring, flex is RB/WR only (no TE-flex) — **note for later:** if this profile is ever re-saved through the in-app League Manager form, `collectLeagueForm()` in `index.html` hardcodes `flexEligible` back to `['RB','WR','TE']` on every save, which would silently break ESPN's narrower flex; needs a code fix, not done tonight (data-only session). Also logged each league's user-stated strategy (guillotine: favor safe-floor over ceiling, fade rookies, value elite QB/TE, keep 1 flex-worthy RB/WR insurance in bench for the 4-week no-trade window; ESPN: weak waiver competition so lock in 1 premium RB/WR + a QB/TE he trusts, don't rush filling RB2/3 or WR2/3) as `notes` fields on each profile — not yet turned into ranking/valuation logic. **Still blocking real draft-room use: no owner/team names for any of the three leagues** — asked user to send team lists (screenshots or pasted text are fine; draft order/slot numbers can come later or live at draft time).

- 🔧 2026-09-04 — **"My Rank" column: reconciled repo with live prod, built it, then made it formulaic per user pushback.** Pulled the real deployed `worker.js`/`index.html` straight from Cloudflare (Scripts API `GET /accounts/:id/workers/scripts/aeo-draft-lab` returns the bundled source; the live asset URL gives the real `index.html`) to close the divergence gap logged above — confirmed it's a full multi-user system (Google OAuth sign-in, per-user KV scoping via `scoped(base,me)`, Yahoo OAuth for the admin) built by another session, not in git until now. Added a "My" column to the Draft Room's Best Available table, separate from ADP/ECR. First pass baked specific players' ranks in by hand (Godwin over MHJ, per user's example) via a static `my_rank` CSV column — user explicitly rejected this: a hand-edited list goes stale the moment news changes (e.g. Godwin gets hurt and should NOT stay artificially ahead). Replaced with `computeMyRanks()`: derives My Rank live every pool load from each player's `ecr`/`pos`/`rookie` fields — elite QB/TE (top 6 by ECR) bumped up 8 spots, current rookie class bumped down 10 spots, weights as named constants (`MY_RANK_WEIGHTS`) for easy retuning. Filled real player pools (237 players, no K/DST, for both guillotine leagues; 250 including K/DST for SCG IRS) into all three leagues via KV, reusing the same base ADP/ECR/proj/tier/rookie data that backs AEO-Keepers (`PLAYERS_CSV_AEO`), matching the existing cross-league reuse pattern (Fantastic/AEOK auctions do the same). **Not modeled yet, by design:** a floor-vs-ceiling/consistency preference (user wants safer/more established players over high-variance boom-bust ones) — there's no volatility/target-share/injury-history data in the pool to compute it from formulaically. User: work on it "maybe tomorrow," use today's draft(s) on the fly in the meantime. Code changes committed locally, not yet deployed — `wrangler deploy` requires explicit user go-ahead (blocked by the auto-mode permission classifier as a live production action).

<!-- Newest first. One line per item: date, status, short description. -->

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
- 🆕 2026-08-25 — **Multiple people logging in with separate save files** —
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
- 🆕 2026-08-24 — **Custom/personal rankings** — wants the ability to enter
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
- ✅ 2026-08-20 — **Player pool is smaller than the draft** — `players-2026.csv`
  has 184 players but the draft is 192 slots (12 × 16), so mocks run dry ~8
  picks early and the last round or two become forced scavenging. Either
  extend the CSV past 192 or shorten `LEAGUE.rounds`. Surfaced while testing
  the new opponent model.
  *Done 2026-08-24 — pool extended to 250, see the "ADP/ECR data feels
  stale" entry above.*
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

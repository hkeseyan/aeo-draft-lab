import assert from 'node:assert/strict';
import { normalizeYahooLeagueImport } from '../worker.js';

const meta = { league: {
  league_key: 'nhl.l.12345',
  name: 'Noon Hockey',
  num_teams: '10',
  scoring_type: 'headpoint',
  draft_type: 'live_standard',
}};

const settings = { settings: {
  scoring_type: 'headpoint',
  draft_type: 'live_standard',
  roster: [
    { roster_position: { position: 'C', count: '2' } },
    { roster_position: { position: 'LW', count: '2' } },
    { roster_position: { position: 'RW', count: '2' } },
    { roster_position: { position: 'D', count: '4' } },
    { roster_position: { position: 'G', count: '2' } },
    { roster_position: { position: 'BN', count: '4' } },
    { roster_position: { position: 'IR', count: '2' } },
  ],
  stat_categories: [
    { stat: { stat_id: '1', abbr: 'G' } },
    { stat: { stat_id: '2', abbr: 'A' } },
    { stat: { stat_id: '3', abbr: 'SOG' } },
  ],
  stat_modifiers: [
    { stat_modifier: { stat_id: '1', value: '6' } },
    { stat_modifier: { stat_id: '2', value: '4' } },
    { stat_modifier: { stat_id: '3', value: '0.9' } },
  ],
}};

const teams = { teams: [
  { team: { team_key: 'nhl.l.12345.t.1', name: 'Hovo', draft_position: '3', is_owned_by_current_login: '1' } },
  { team: { team_key: 'nhl.l.12345.t.2', name: 'Other', draft_position: '1' } },
]};

const players = [
  { name: 'Jason Robertson', pos: 'LW/RW' },
  { name: 'Connor McDavid', pos: 'C' },
];

const p = normalizeYahooLeagueImport(meta, settings, teams, players, 'nhl.l.12345', 'nhl');

assert.equal(p.platform, 'yahoo');
assert.equal(p.sport, 'nhl');
assert.equal(p.teams, 10);
assert.equal(p.rounds, 16);
assert.equal(p.rosterSize, 16);
assert.equal(p.irSlots, 2);
assert.deepEqual(p.starters, { C: 2, LW: 2, RW: 2, D: 4, G: 2 });
assert.equal(p.mySlot, 3);
assert.equal(p.meOwner, 'Hovo');
assert.equal(p.scoringMode, 'points');
assert.equal(p.scoring.g, 6);
assert.equal(p.scoring.a, 4);
assert.equal(p.scoring.sog, 0.9);
assert.equal(p.platformEligibility.yahoo['jason robertson'], 'LW/RW');
assert.equal(p.yahooLeagueKey, 'nhl.l.12345');

console.log('Yahoo NHL import normalization: all checks passed.');

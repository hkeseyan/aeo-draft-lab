import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../worker.js';

// Drives GET /api/nba/preseason-projections with fixtures cut from the real pages
// (Hashtag Basketball's show-All postback, a CBS Sports position page, ESPN's
// fantasy API), so the parsers are proven against actual markup.
const fixture = (f) => fs.readFileSync('tests/fixtures/' + f, 'utf8');
const hashtagPage = '<form><input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="vs" />'
  + '<select name="ctl00$ContentPlaceHolder1$DDSHOW"><option selected="selected" value="30">Top 30</option><option value="900">All</option></select>'
  + '<input id="ContentPlaceHolder1_CBPTS" type="checkbox" name="ctl00$ContentPlaceHolder1$CBPTS" checked="checked" />'
  + '<input id="ContentPlaceHolder1_CBFGM" type="checkbox" name="ctl00$ContentPlaceHolder1$CBFGM" /></form>';
const store = {};
const kv = { get: async (k) => store[k] ? JSON.parse(store[k]) : null, put: async (k, v) => { store[k] = v; }, delete: async () => {}, list: async () => ({ keys: [] }) };
const env = { MOCKS: kv };
let failing = new Set(), posted = null, calls = 0, cbsPages = [], hashtagOops = false;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  calls++;
  const src = u.includes('hashtagbasketball') ? 'hashtag' : u.includes('cbssports') ? 'cbs' : u.includes('espn') ? 'espn' : null;
  assert.ok(src, 'unexpected outbound request: ' + u);
  if (failing.has(src)) return new Response('down', { status: 500 });
  if (src === 'hashtag') {
    if (opts.method === 'POST') { posted = new URLSearchParams(opts.body); return new Response(hashtagOops ? '<html><title>Oops | Hashtag Basketball</title></html>' : fixture('nba-hashtag-rows.html')); }
    return new Response(hashtagPage);
  }
  // Every position page serves the same three players: a multi-eligible player
  // listed on several pages must come back once.
  if (src === 'cbs') { cbsPages.push(u.match(/stats\/(\w+)\//)[1]); return new Response(fixture('nba-cbs-projections.html')); }
  return new Response(fixture('nba-espn-projections.json'));
};
const call = () => worker.fetch(new Request('https://x.test/api/nba/preseason-projections'), env, {});

// ---- all three sources --------------------------------------------------------
let res = await call(), body = await res.json();
assert.equal(res.status, 200);
assert.deepEqual(body.errors, {});
assert.deepEqual(body.sources.map((s) => s.id), ['hashtag', 'cbs', 'espn']);
assert.equal(posted.get('ctl00$ContentPlaceHolder1$DDSHOW'), '900', 'asks Hashtag for every player');
assert.equal(posted.get('ctl00$ContentPlaceHolder1$DDPOSFROM'), '1', 'asks Hashtag for Yahoo positions');
assert.equal(posted.get('__VIEWSTATE'), 'vs', 'replays the page state');
assert.equal(posted.get('ctl00$ContentPlaceHolder1$CBPTS'), 'on', 'replays checked category boxes');
assert.equal(posted.get('ctl00$ContentPlaceHolder1$CBFGM'), null, 'leaves unchecked boxes out');
const hb = body.sources[0].rows.find((r) => r.name === 'Nikola Jokic');
assert.ok(hb, 'Hashtag row parsed');
assert.equal(hb.gp, 72);
assert.ok(Math.abs(hb.pts - 28.4 * 72) < 1e-6, 'per-game rates become season totals');
assert.ok(Math.abs(hb.fga - 18.3 * 72) < 1e-6 && Math.abs(hb.fta - 6.8 * 72) < 1e-6, 'attempts carried through');
const cbs = body.sources[1];
assert.equal(cbs.rateOnly, true, 'CBS is flagged rate-only (it projects near-full seasons)');
assert.deepEqual(cbsPages.sort(), ['C', 'PF', 'PG', 'SF', 'SG'], 'one CBS page per position');
assert.deepEqual(cbs.rows.map((r) => r.name), ['Luka Doncic', 'Shai Gilgeous-Alexander', 'Cade Cunningham'], 'deduped by CBS player id');
const luka = cbs.rows[0];
assert.equal(luka.gp, 79.5);
assert.equal(luka.team, 'LAL');
assert.ok(luka.pts === 2315.1 && luka.fga === 1596.7 && luka.fta === 743.9 && luka.tpm === 270.9 && luka.blk === 33.4 && luka.to === 324.9 && luka.min === 2851, 'season totals with attempts');
const espn = body.sources[2].rows;
assert.equal(espn.find((r) => r.name === 'Nikola Jokic').gp, 72);
assert.ok(!espn.some((r) => r.name === 'Junk Line'), 'implausible 17% FG line is rejected');

// ---- cached: no outbound calls on a repeat ------------------------------------
calls = 0;
res = await call();
assert.equal(res.status, 200);
assert.equal(calls, 0, 'served from the six-hour cache');

// ---- one source down: the others still come back ------------------------------
for (const k of Object.keys(store)) delete store[k];
failing = new Set(['cbs']);
res = await call(); body = await res.json();
assert.equal(res.status, 200);
assert.deepEqual(body.sources.map((s) => s.id), ['hashtag', 'espn']);
assert.match(body.errors.cbs, /500/);

// ---- Hashtag's show-All gated (Premium-only since 2026-10): named, not silent --
for (const k of Object.keys(store)) delete store[k];
failing = new Set(); hashtagOops = true;
res = await call(); body = await res.json();
assert.equal(res.status, 200);
assert.deepEqual(body.sources.map((s) => s.id), ['cbs', 'espn']);
assert.match(body.errors.hashtag, /Premium/);
hashtagOops = false;

// ---- everything down: 502, nothing cached --------------------------------------
for (const k of Object.keys(store)) delete store[k];
failing = new Set(['hashtag', 'cbs', 'espn']);
res = await call();
assert.equal(res.status, 502);
assert.equal(Object.keys(store).length, 0, 'a total failure is not cached');

console.log('NBA preseason projection route tests passed');

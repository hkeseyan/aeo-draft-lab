import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../worker.js';

// Drives GET /api/nba/preseason-projections with fixtures cut from the real pages
// (Hashtag Basketball's show-All postback, FantasyPros' projections table, ESPN's
// fantasy API), so the parsers are proven against actual markup.
const fixture = (f) => fs.readFileSync('tests/fixtures/' + f, 'utf8');
const hashtagPage = '<form><input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="vs" />'
  + '<select name="ctl00$ContentPlaceHolder1$DDSHOW"><option selected="selected" value="30">Top 30</option><option value="900">All</option></select></form>';
const store = {};
const kv = { get: async (k) => store[k] ? JSON.parse(store[k]) : null, put: async (k, v) => { store[k] = v; }, delete: async () => {}, list: async () => ({ keys: [] }) };
const env = { MOCKS: kv };
let failing = new Set(), posted = null, calls = 0;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  calls++;
  const src = u.includes('hashtagbasketball') ? 'hashtag' : u.includes('fantasypros') ? 'fp' : u.includes('espn') ? 'espn' : null;
  assert.ok(src, 'unexpected outbound request: ' + u);
  if (failing.has(src)) return new Response('down', { status: 500 });
  if (src === 'hashtag') {
    if (opts.method === 'POST') { posted = new URLSearchParams(opts.body); return new Response(fixture('nba-hashtag-rows.html')); }
    return new Response(hashtagPage);
  }
  if (src === 'fp') return new Response(fixture('nba-fantasypros-projections.html'));
  return new Response(fixture('nba-espn-projections.json'));
};
const call = () => worker.fetch(new Request('https://x.test/api/nba/preseason-projections'), env, {});

// ---- all three sources --------------------------------------------------------
let res = await call(), body = await res.json();
assert.equal(res.status, 200);
assert.deepEqual(body.errors, {});
assert.deepEqual(body.sources.map((s) => s.id), ['hashtag', 'fp', 'espn']);
assert.equal(posted.get('ctl00$ContentPlaceHolder1$DDSHOW'), '900', 'asks Hashtag for every player');
assert.equal(posted.get('ctl00$ContentPlaceHolder1$DDPOSFROM'), '1', 'asks Hashtag for Yahoo positions');
assert.equal(posted.get('__VIEWSTATE'), 'vs', 'replays the page state');
const hb = body.sources[0].rows.find((r) => r.name === 'Nikola Jokic');
assert.ok(hb, 'Hashtag row parsed');
assert.equal(hb.gp, 72);
assert.ok(Math.abs(hb.pts - 28.4 * 72) < 1e-6, 'per-game rates become season totals');
assert.ok(Math.abs(hb.fga - 18.3 * 72) < 1e-6 && Math.abs(hb.fta - 6.8 * 72) < 1e-6, 'attempts carried through');
const fp = body.sources[1];
assert.equal(fp.noAttempts, true, 'FantasyPros is flagged as attempt-free');
assert.ok(fp.rows.length >= 2 && fp.rows.every((r) => r.gp > 0 && Number.isFinite(r.pts) && r.fga === undefined));
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
failing = new Set(['fp']);
res = await call(); body = await res.json();
assert.equal(res.status, 200);
assert.deepEqual(body.sources.map((s) => s.id), ['hashtag', 'espn']);
assert.match(body.errors.fp, /500/);

// ---- everything down: 502, nothing cached --------------------------------------
for (const k of Object.keys(store)) delete store[k];
failing = new Set(['hashtag', 'fp', 'espn']);
res = await call();
assert.equal(res.status, 502);
assert.equal(Object.keys(store).length, 0, 'a total failure is not cached');

console.log('NBA preseason projection route tests passed');

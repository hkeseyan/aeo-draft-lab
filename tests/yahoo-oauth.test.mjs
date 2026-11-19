import assert from 'node:assert/strict';
import worker from '../worker.js';

class MemoryKv {
  constructor(entries={}) { this.data=new Map(Object.entries(entries)); }
  async get(key, options) {
    const v=this.data.get(key); if(v==null)return null;
    return options&&options.type==='json'?JSON.parse(v):v;
  }
  async put(key,value){this.data.set(key,String(value));}
  async delete(key){this.data.delete(key);}
  async list({prefix=''}={}){return {keys:[...this.data.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name}))};}
}

const oldGrant={access_token:'old',refresh_token:'old-refresh',expires_at:Date.now()+3600000,connected_at:Date.now()-1000,client_id:'old-client'};
const kv=new MemoryKv({'yahooAuth:default':JSON.stringify(oldGrant)});
const env={MOCKS:kv,YAHOO_CLIENT_ID:'new-client',YAHOO_CLIENT_SECRET:'new-secret'};

let response=await worker.fetch(new Request('https://draft.test/api/yahoo/status'),env,{});
assert.equal(response.status,200);
let body=await response.json();
assert.equal(body.connected,false);
assert.equal(body.stale_grant,true);

response=await worker.fetch(new Request('https://draft.test/api/yahoo/leagues?game=nhl'),env,{});
assert.equal(response.status,401,'stale grant should be invalidated before a Yahoo API call');
assert.equal(kv.data.has('yahooAuth:default'),false,'stale client-bound grant should be removed');

const old = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Unsolicited callback must never call Yahoo."); };
try {
  response = await worker.fetch(new Request('https://draft.test/auth/yahoo/callback?code=unsolicited'),env,{});
  assert.equal(response.status, 403);
  response = await worker.fetch(new Request('https://draft.test/auth/yahoo/start'),env,{});
  assert.equal(response.status, 302);
  assert.match(new URL(response.headers.get('location')).searchParams.get('state'), /^[a-f0-9-]+$/);
  assert.match(response.headers.get('set-cookie'), /aeo_yahoo_oauth_state=.*Secure.*HttpOnly|aeo_yahoo_oauth_state=.*HttpOnly.*Secure/);
} finally { globalThis.fetch = old; }

console.log('Yahoo OAuth client-binding tests passed.');

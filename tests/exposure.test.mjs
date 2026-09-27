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

const j=x=>JSON.stringify(x);
const kv=new MemoryKv({
  'league:current':j({id:'current',name:'Next Yahoo Draft',sport:'nhl',officialDraft:false}),
  'league:official':j({id:'official',name:'Yahoo Prize 135526',sport:'nhl',officialDraft:true,teams:12,mySlot:4}),
  'league:mock':j({id:'mock',name:'Practice Mock',sport:'nhl',officialDraft:false,teams:12,mySlot:1}),
  'league:football':j({id:'football',name:'NFL Official',sport:'nfl',officialDraft:true,teams:12,mySlot:1}),
  'setup:official':j({myRosterNames:['Nikita Kucherov','Auston Matthews']}),
  'setup:mock':j({myRosterNames:['Nikita Kucherov','Jason Robertson']}),
  'setup:football':j({myRosterNames:['Josh Allen']}),
});
const env={MOCKS:kv};

const res=await worker.fetch(new Request('https://draft.test/api/exposure?league=current'),env,{});
assert.equal(res.status,200);
const body=await res.json();
assert.equal(body.denominator,1,'only official drafted same-sport leagues count');
assert.equal(body.counts['nikita kucherov'],1);
assert.equal(body.counts['auston matthews'],1);
assert.equal(body.counts['jason robertson'],undefined,'mock roster must not affect exposure');
assert.deepEqual(body.leagues.map(x=>x.id),['official']);

console.log('Official-league exposure tests passed.');

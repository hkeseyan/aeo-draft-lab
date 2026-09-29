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
  'league:official':j({id:'official',name:'Yahoo Prize 135526',sport:'nhl',officialDraft:true,teams:2,mySlot:1,
    initialPickNames:['Nikita Kucherov','Other Manager Pick','Other Manager Pick 2','Auston Matthews']}),
  'league:mock':j({id:'mock',name:'Practice Mock',sport:'nhl',officialDraft:false,teams:12,mySlot:1}),
  'league:football':j({id:'football',name:'NFL Official',sport:'nfl',officialDraft:true,teams:12,mySlot:1}),
  'setup:mock':j({myRosterNames:['Nikita Kucherov','Jason Robertson']}),
  // Completed official board added after mocks were saved in the same league.
  'league:trax':j({id:'trax',name:'Fantrax Official',sport:'nhl',officialDraft:true,teams:2,rounds:2,mySlot:2,
    initialPickNames:['Other Manager Pick','Kirill Kaprizov','Elias Pettersson (C)','Other Manager Pick 3']}),
  'setup:trax':j({myRosterNames:['Connor McDavid'],picks:[]}),
  'setup:football':j({myRosterNames:['Josh Allen']}),
});
const env={MOCKS:kv};

const res=await worker.fetch(new Request('https://draft.test/api/exposure?league=current'),env,{});
assert.equal(res.status,200);
const body=await res.json();
assert.equal(body.denominator,2,'only official drafted same-sport leagues count, even without a saved setup');
assert.equal(body.counts['nikita kucherov'],1);
assert.equal(body.counts['auston matthews'],1);
assert.equal(body.counts['jason robertson'],undefined,'mock roster must not affect exposure');
assert.deepEqual(body.leagues.map(x=>x.id).sort(),['official','trax']);
assert.equal(body.counts['kirill kaprizov'],1,'a complete official board beats a stale mock setup');
assert.equal(body.counts['elias pettersson'],1,'position qualifiers are stripped from exposure keys');
assert.equal(body.counts['connor mcdavid'],undefined,'stale mock roster is ignored once the official board exists');

console.log('Official-league exposure tests passed.');

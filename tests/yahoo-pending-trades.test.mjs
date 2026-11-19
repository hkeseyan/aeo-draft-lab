import assert from 'node:assert/strict';
import { normalizeYahooPendingTrades } from '../yahoo-pending-trades.js';

const league='449.l.868349', mine=league+'.t.1', other=league+'.t.2';
const player=(key,name,source,destination)=>[
  [{player_key:key,name:{full:name},display_position:'RB'}],
  {transaction_data:{type:'pending_trade',source_type:'team',source_team_key:source,destination_type:'team',destination_team_key:destination}}
];
const trade=(id,from,to,players,status='proposed')=>[
  {transaction_key:league+'.pt.'+id,type:'pending_trade',status,trader_team_key:from,tradee_team_key:to,trade_proposed_time:'1795050000',trade_note:'What do you think?'},
  {players:Object.fromEntries(players.map((p,i)=>[i,{player:p}]).concat([['count',players.length]]))}
];
const response={fantasy_content:{league:[
  {league_key:league},{transactions:{
    0:{transaction:trade(11,other,mine,[player('449.p.1','Player A',other,mine),player('449.p.2','Player B',mine,other)])},
    1:{transaction:trade(12,mine,other,[player('449.p.3','Player C',mine,other),player('449.p.4','Player D',other,mine)])},
    2:{transaction:trade(13,league+'.t.3',league+'.t.4',[])},
    count:3
  }}
]}};
const teams=[{team_key:mine,name:'Pennybags'},{team_key:other,name:'Rival'}];
const offers=normalizeYahooPendingTrades(response,mine,teams);
assert.equal(offers.length,2,'foreign team offers are excluded');
assert.equal(offers[0].transactionKey,league+'.pt.11');
assert.equal(offers[0].direction,'incoming');
assert.equal(offers[0].partnerTeamName,'Rival');
assert.deepEqual(offers[0].receiving.map(p=>p.name),['Player A']);
assert.deepEqual(offers[0].giving.map(p=>p.name),['Player B']);
assert.equal(offers[0].status,'proposed');
assert.equal(offers[0].complete,true);
assert.equal(offers[1].direction,'outgoing');
assert.deepEqual(offers[1].giving.map(p=>p.name),['Player C']);
assert.deepEqual(offers[1].receiving.map(p=>p.name),['Player D']);
assert.equal(offers[0].note,'What do you think?');
assert.deepEqual(normalizeYahooPendingTrades({fantasy_content:{league:[{}, {transactions:{count:0}}]}},mine,teams),[]);
assert.throws(()=>normalizeYahooPendingTrades(response,'',teams),/verified Yahoo team key/);
const withPicks={fantasy_content:{league:[{}, {transactions:{0:{transaction:[
  {transaction_key:league+'.pt.19',type:'pending_trade',status:'proposed',trader_team_key:other,tradee_team_key:mine},
  {draft_picks:{0:{draft_pick:{round:4}}}}
]},count:1}}]}};
const pickOffer=normalizeYahooPendingTrades(withPicks,mine,teams)[0];
assert.equal(pickOffer.containsDraftPicks,true);
assert.equal(pickOffer.complete,false);
console.log('Yahoo pending-trade normalization tests passed');

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {migrate,type DB,audit} from '../src/db';
import {saveMarket,executePaper,resolvePosition,snapshot} from '../src/engine';
import type {Market,Book} from '../src/polymarket';

test('PostgreSQL migration, paper entry, replay protection, settlement, audit and rollback',async()=>{
 const p=new PGlite();const adapter=(t:any):DB=>({query:async(sql,values)=>{if(!values&&sql.includes(';')){const result=await t.exec(sql);return result.at(-1)??{rows:[]};}return t.query(sql,values);}});const q=adapter(p);await migrate(q);await migrate(q);
 assert.equal((await q.query('SELECT cash FROM portfolio')).rows[0].cash,'1000.000000');
 const m:Market={id:'test-only',slug:'test-fixture',question:'TEST FIXTURE',description:'Official result decides long outcome',category:'test',endDate:new Date(Date.now()+86400000).toISOString(),active:true,closed:false,status:'MARKET_STATUS_OPEN',marketSides:[{id:'long',long:true,description:'Long'},{id:'short',long:false,description:'Short'}]};await saveMarket(q,m);
 const b:Book={slug:m.slug,bids:[{price:'.39',quantity:'10000'}],offers:[{price:'.4',quantity:'10000'}],observedAt:new Date(),exchangeAt:null,state:'MARKET_STATE_OPEN',raw:{fixture:true}};
 const analysis={clearRules:true,unresolvedContradictions:false,analysts:[{analysis:{sources:[1,2,3].map(()=>({publishedAt:new Date().toISOString()}))}}]};
 const id=(await q.query('INSERT INTO research_runs(market_id,strategy_id,analysis,probability,confidence,quality,disagreement) VALUES($1,1,$2,.8,.95,.95,.02) RETURNING id',[m.id,JSON.stringify(analysis)])).rows[0].id;
 const first=await p.transaction(t=>executePaper(adapter(t),id,m,b));assert.equal(first.status,'filled');assert.equal((await p.transaction(t=>executePaper(adapter(t),id,m,b))).status,'duplicate');
 const cash=Number((await q.query('SELECT cash FROM portfolio')).rows[0].cash),position=(await q.query('SELECT * FROM positions')).rows[0];assert.equal(cash+Number(position.cost),1000);
 await p.transaction(t=>resolvePosition(adapter(t),m.id,'1',{fixture:true}));const after=(await q.query('SELECT cash FROM portfolio')).rows[0].cash;await p.transaction(t=>resolvePosition(adapter(t),m.id,'1',{fixture:true}));assert.equal((await q.query('SELECT cash FROM portfolio')).rows[0].cash,after);assert.ok(Number(after)>1000);
 await assert.rejects(q.query('UPDATE research_runs SET probability=.1'));await assert.rejects(q.query('DELETE FROM simulated_fills'));await assert.rejects(q.query('DELETE FROM audit_events'));
 await assert.rejects(p.transaction(async t=>{await t.query('UPDATE portfolio SET cash=1 WHERE id=1');throw Error('rollback');}));assert.equal((await q.query('SELECT cash FROM portfolio')).rows[0].cash,after);
 await p.transaction(t=>snapshot(adapter(t)));await p.transaction(t=>audit(adapter(t),'TEST',{fixture:true}));assert.ok((await q.query('SELECT * FROM audit_events')).rows.length>=3);await p.close();
});

import {test} from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {migrate,type DB} from "../src/db";
import {saveMarket,executePaper,resolvePosition} from "../src/engine";
import {strictEntryStatus} from "../src/strict-run";
import {reviewPosition} from "../src/monitor";
test("strict run rejects weak evidence, caps size and count, and exits at deadline",async()=>{
  const p=new PGlite();
  const adapt=(t:any):DB=>({query:async(sql,values)=>!values && sql.includes(';') ? (await t.exec(sql)).at(-1) : t.query(sql,values)});
  const q=adapt(p);
  process.env.STRICT_PAPER_RUN="true";
  process.env.RUN_START_AT=new Date(Date.now()-1000).toISOString();
  process.env.RUN_END_AT=new Date(Date.now()+8*3600000).toISOString();
  process.env.RUN_START_EQUITY="1000";
  process.env.RUN_TRADE_TARGET="1";
  try {
    await migrate(q);
    const m:any={id:"strict",slug:"strict",question:"fixture",description:"Official result",category:"test",endDate:new Date(Date.now()+4*3600000).toISOString(),gameStartTime:new Date().toISOString(),marketType:"moneyline",active:true,closed:false,status:"MARKET_STATUS_OPEN",marketSides:[{id:"long",long:true,description:"Long"},{id:"short",long:false,description:"Short"}]};
    const b:any={slug:m.slug,bids:[{price:".49",quantity:"10000"}],offers:[{price:".5",quantity:"10000"}],observedAt:new Date(),exchangeAt:null,state:"MARKET_STATE_OPEN",raw:{fixture:true}};
    await saveMarket(q,m);
    const analysis={clearRules:true,unresolvedContradictions:false,analysts:[{analysis:{sources:[1,2,3].map(()=>({publishedAt:new Date().toISOString()}))}}]};
    async function research(prob:number,confidence:number) {return (await q.query("INSERT INTO research_runs(market_id,strategy_id,analysis,probability,confidence,quality,disagreement) VALUES($1,1,$2,$3,$4,.95,.01) RETURNING id",[m.id,JSON.stringify(analysis),prob,confidence])).rows[0].id;}
    for(const [prob,conf] of [[.79,.95],[.9,.84]]) {
      const id=await research(prob,conf);
      const result=await p.transaction(t=>executePaper(adapt(t),id,m,b));
      assert.equal(result.status,"rejected");
    }
    const id=await research(.9,.95);
    assert.equal((await p.transaction(t=>executePaper(adapt(t),id,m,b))).status,"filled");
    const position=(await q.query("SELECT * FROM positions")).rows[0];
    assert.ok(Number(position.cost)<=25);
    assert.equal(await strictEntryStatus(q),"Trade target reached");
    process.env.RUN_TRADE_TARGET="20";
    assert.equal(await strictEntryStatus(q,m.id),"Market already traded this run");
    process.env.RUN_END_AT=new Date(Date.now()+10*60000).toISOString();
    const result=await p.transaction(t=>reviewPosition(adapt(t),position.id,m,{...b,observedAt:new Date()},true));
    assert.equal(result?.action,"EXIT");
    assert.ok((await q.query("SELECT closed_at FROM positions")).rows[0].closed_at);
    process.env.RUN_END_AT=new Date(Date.now()+8*3600000).toISOString();
    await q.query("UPDATE portfolio SET cash=979 WHERE id=1");
    assert.equal(await strictEntryStatus(q),"Run loss limit reached");
  } finally {await p.close();}
});

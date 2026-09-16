import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrate, type DB } from "../src/db";
import { exploratoryBuy } from "../src/exploration";
import { reviewPosition } from "../src/monitor";
import { saveMarket, snapshot } from "../src/engine";
import type { Market, Book } from "../src/polymarket";

test("exploratory ledger has no fake research, respects limits, and exits with real depth", async()=>{
  process.env.RUN_START_AT = new Date(Date.now()-1000).toISOString();
  process.env.RUN_END_AT = new Date(Date.now()+8*3600000).toISOString();
  process.env.EXPLORATORY_PAPER_ENABLED = "true";
  process.env.PAPER_TRADING_ENABLED = "true";
  const p = new PGlite();
  const adapter=(t:any):DB=>({query:async(sql,values)=>!values && sql.includes(";") ? (await t.exec(sql)).at(-1) : t.query(sql,values)});
  const q=adapter(p);
  try {
    await migrate(q);
    const m:Market={id:"test",slug:"test",question:"Fixture only",description:"Winner decided by official final score including overtime",category:"test",marketType:"moneyline",gameStartTime:new Date().toISOString(),endDate:new Date(Date.now()+5*3600000).toISOString(),active:true,closed:false,status:"MARKET_STATUS_OPEN",marketSides:[{id:"a",description:"A",long:true},{id:"b",description:"B",long:false}]};
    const b:Book={slug:m.slug,bids:[{price:".64",quantity:"1000"}],offers:[{price:".65",quantity:"1000"}],state:"MARKET_STATE_OPEN",observedAt:new Date(),exchangeAt:null,raw:{fixture:true}};
    await saveMarket(q,m);
    assert.equal((await p.transaction(t=>exploratoryBuy(adapter(t),m,{...b,observedAt:new Date(0)}))).status,"ineligible");
    assert.equal((await p.transaction(t=>exploratoryBuy(adapter(t),m,{...b,slug:"wrong"}))).status,"ineligible");
    const buy=await p.transaction(t=>exploratoryBuy(adapter(t),m,b));
    assert.equal(buy.status,"filled");
    const pos=(await q.query("SELECT * FROM positions")).rows[0];
    assert.ok(Number(pos.cost)<=5);
    assert.equal((await q.query("SELECT * FROM research_runs")).rows.length,0);
    assert.equal((await q.query("SELECT research_id FROM simulated_orders")).rows[0].research_id,null);
    assert.equal(Number((await q.query("SELECT cash FROM portfolio")).rows[0].cash)+Number(pos.cost),1000);
    assert.equal((await p.transaction(t=>exploratoryBuy(adapter(t),m,b))).status,"duplicate");
    const other={...m,id:"other",slug:"other"}; await saveMarket(q,other);
    assert.equal((await p.transaction(t=>exploratoryBuy(adapter(t),other,{...b,slug:other.slug}))).status,"cooldown");
    await assert.rejects(p.transaction(t=>reviewPosition(adapter(t),pos.id,m,{...b,slug:"wrong"},true)),/does not match/);
    const winning={...b,bids:[{price:".80",quantity:"1"}]};
    assert.equal((await p.transaction(t=>reviewPosition(adapter(t),pos.id,m,winning,true)))?.action,"HOLD");
    assert.equal((await q.query("SELECT closed_at FROM positions")).rows[0].closed_at,null);
    assert.equal((await p.transaction(t=>reviewPosition(adapter(t),pos.id,m,{...winning,bids:[{price:".80",quantity:"1000"}]},true)))?.action,"EXIT");
    assert.ok(Number((await q.query("SELECT realized_pnl FROM positions")).rows[0].realized_pnl)>0);
    await p.transaction(t=>snapshot(adapter(t)));
    process.env.RUN_END_AT=new Date(Date.now()+10*60000).toISOString();
    assert.equal((await p.transaction(t=>exploratoryBuy(adapter(t),other,{...b,slug:other.slug}))).status,"entry_window_closed");
    process.env.RUN_END_AT=new Date(0).toISOString();
    await assert.rejects(p.transaction(t=>exploratoryBuy(adapter(t),m,b)),/authorized time window/);
  } finally { await p.close(); }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { accountedCost } from "../src/cost-accounting";
const responses=()=>[1,2,3].map(id=>({status:"completed",detail:{responseId:String(id),model:"gpt-5-mini",usage:{input_tokens:10000,output_tokens:1000},output:[{type:"web_search_call"}]}}));
test("completed usage replaces reservations with rounded conservative cost",()=>{
  assert.equal(accountedCost(2,responses()),0.09);
});
test("missing usage, failures, unknown models and duplicate responses retain reservations",()=>{
  assert.equal(accountedCost(2,[]),2);
  for(const mutate of [(r:any)=>r.status="incomplete",(r:any)=>r.detail.model="other",(r:any)=>delete r.detail.usage,(r:any)=>r.detail.usage.input_tokens=-1]){
    const r=responses();mutate(r[0]);assert.equal(accountedCost(2,r),2);
  }
  const r=responses();r[1]=r[0];assert.equal(accountedCost(2,r),2);
});

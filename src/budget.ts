import {transaction,audit} from './db';
/** Conservative reservation stays consumed even after failure; no silent automatic retries. */
export async function reserveResearch(marketId:string){return transaction(async q=>{
 await q.query('SELECT id FROM portfolio WHERE id=1 FOR UPDATE');
 const row=(await q.query("SELECT COALESCE(SUM(reserved_usd),0) AS lifetime,COALESCE(SUM(reserved_usd) FILTER(WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0) AS daily FROM research_budget_reservations")).rows[0];
 const daily=Number(process.env.RESEARCH_DAILY_RESERVE_USD??1),lifetime=Number(process.env.RESEARCH_LIFETIME_RESERVE_USD??5);
 if(!Number.isFinite(daily)||!Number.isFinite(lifetime)||Number(row.daily)+1>daily||Number(row.lifetime)+1>lifetime)throw Error('Research reservation budget exhausted');
 const id=(await q.query('INSERT INTO research_budget_reservations(reserved_usd,market_id) VALUES(1,$1) RETURNING id',[marketId])).rows[0].id;
 await audit(q,'RESEARCH_BUDGET_RESERVED',{id,marketId,reservedUsd:1});return id;
});}
